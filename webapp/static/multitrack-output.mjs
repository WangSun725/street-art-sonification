export function bindMultitrackOutput(panel, instrumentLabels, enableAudio, engine) {
  const devicePicker = panel.querySelector("select");
  const button = panel.querySelector("button");
  const status = panel.querySelector("[role=status]");
  const channels = panel.querySelector("ol");
  const labels = [...instrumentLabels, "Shared FX", "Master reference"];
  const channelCount = labels.length * 2;
  for (const [index, name] of labels.entries()) {
    const item = document.createElement("li");
    item.textContent = `${2 * index + 1}/${2 * index + 2} · ${name}`;
    channels.append(item);
  }

  let socket = null;
  let stopCapture = null;
  let connectTimeout;

  async function loadDevices() {
    button.disabled = true;
    status.textContent = "Looking for audio devices…";
    try {
      const response = await fetch("/api/multitrack/devices", { cache: "no-store" });
      if (response.status === 404) throw new Error("Restart the local server to enable multitrack output.");
      if (!response.ok) throw new Error((await response.json()).detail || "Audio devices are unavailable.");
      const devices = (await response.json()).filter(device => device.channels >= channelCount);
      devicePicker.replaceChildren(...devices.map(device => new Option(device.name, device.id)));
      const loopback = devices.find(device => device.name === "BlackHole 64ch");
      if (loopback) devicePicker.value = loopback.id;
      status.textContent = devices.length ? "Disconnected" : `Connect an audio device with at least ${channelCount} outputs.`;
      button.disabled = !devices.length;
    } catch (error) {
      status.textContent = error.message;
    }
  }

  function disconnect(message = "Disconnected") {
    const connection = socket;
    socket = null;
    clearTimeout(connectTimeout);
    stopCapture?.();
    stopCapture = null;
    connection?.close();
    devicePicker.disabled = false;
    button.disabled = !devicePicker.options.length;
    button.textContent = "Connect";
    status.textContent = message;
  }

  async function connect() {
    button.disabled = true;
    devicePicker.disabled = true;
    status.textContent = "Connecting…";
    try {
      if (!await enableAudio()) throw new Error("Start browser audio and try again.");
      const target = Number(devicePicker.value);
      const url = new URL("/api/multitrack/stream", location.href);
      url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
      const connection = socket = new WebSocket(url);
      connectTimeout = setTimeout(() => disconnect("The audio bridge did not respond. Try reconnecting."), 6000);
      connection.addEventListener("open", () => {
        connection.send(JSON.stringify({ device: target, sampleRate: engine.context.sampleRate }));
      });
      connection.addEventListener("close", () => {
        if (socket === connection) disconnect("Audio connection closed. Reconnect to resume.");
      });
      connection.addEventListener("message", async ({ data }) => {
        if (socket !== connection) return;
        const message = JSON.parse(data);
        if (message.type === "error") {
          disconnect(message.message);
        } else if (message.type === "stopped") {
          disconnect(message.dropouts
            ? `Disconnected · ${message.dropouts} audio interruptions`
            : "Disconnected");
        } else if (message.type === "dropout") {
          status.textContent = `${message.count} audio interruptions · ${channelCount} channels connected`;
        } else if (message.type === "ready") {
          try {
            if (message.channels !== channelCount) throw new Error("The audio channel map doesn't match the bridge.");
            let started = false;
            const stop = await engine.captureMultitrack(block => {
              if (connection.readyState !== WebSocket.OPEN) return;
              if (connection.bufferedAmount >= block.byteLength * 12) {
                disconnect("The audio connection stalled. Reconnect to resume.");
                return;
              }
              connection.send(block);
              if (!started) {
                started = true;
                clearTimeout(connectTimeout);
                status.textContent = `${channelCount} channels connected`;
                button.textContent = "Disconnect";
                button.disabled = false;
              }
            });
            if (socket !== connection) {
              stop();
              return;
            }
            stopCapture = stop;
          } catch (error) {
            if (socket === connection) disconnect(error.message);
          }
        }
      });
    } catch (error) {
      disconnect(error.message);
    }
  }

  panel.addEventListener("toggle", () => {
    if (panel.open && !socket) void loadDevices();
  });
  button.addEventListener("click", () => {
    if (socket?.readyState === WebSocket.OPEN) {
      stopCapture?.();
      stopCapture = null;
      button.disabled = true;
      status.textContent = "Finishing output…";
      socket.send("stop");
      connectTimeout = setTimeout(() => disconnect("The audio bridge stopped responding."), 6500);
    } else if (socket) disconnect("Audio connection closed. Reconnect to resume.");
    else void connect();
  });
  window.addEventListener("pagehide", () => {
    if (socket) disconnect();
  });
  if (panel.open) void loadDevices();
}
