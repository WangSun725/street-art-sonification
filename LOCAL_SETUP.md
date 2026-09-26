# 本地笔触模型

本目录已经配置好 CVPR 2021 官方项目 **Stylized Neural Painting** 的油画笔触轻量模型。

## 已安装内容

- Python 3.11 隔离环境：`.venv/`
- 官方代码：`third_party/stylized-neural-painting/`
- 油画笔触轻量权重：`third_party/stylized-neural-painting/checkpoints_G_oilpaintbrush_light/`
- Apple Silicon / Metal 兼容补丁：自动选择 CUDA、MPS 或 CPU
- PyTorch 2.6+ checkpoint 兼容补丁

模型代码与权重采用作者声明的 CC BY-NC-SA 4.0 许可，适合研究和非商业用途；商业用途需另行确认授权。

## 生成任意图片

```bash
./run_brushstroke.sh "/absolute/path/to/image.jpg"
```

也可以指定输出目录和长边像素：

```bash
./run_brushstroke.sh "/absolute/path/to/image.jpg" "/absolute/path/to/output" 1030
```

每次会生成：

- `*_final.png`：最终笔触图
- `*_input.png`：模型实际使用的输入图
- `*_strokes.npz`：可编辑笔触参数，包括形状、颜色和透明度

## 将笔触重放成视频

```bash
.venv/bin/python render_stroke_video.py \
  outputs/final/the-defiant-one_strokes.npz \
  outputs/final/the-defiant-one_stroke-process.mp4 \
  --reference-image inputs/the-defiant-one.webp
```

视频会按照参数中保存的顺序，从空白画布逐笔绘制到最终图像。

## 本次结果

本次参考图使用 5 级渐进绘制，共生成 495 个油画笔触：

- `outputs/final/the-defiant-one_final.png`
- `outputs/final/the-defiant-one_strokes.npz`

## Art2Mus 图片生成音乐

本项目也配置了 **Art2Mus-4**，可以使用一张艺术作品图片生成音乐片段。

### 已安装内容

- Python 3.10 隔离环境：`.art2mus-env/`
- Art2Mus 官方代码与图像投影权重：`third_party/art2mus/`
- AudioLDM2 权重缓存：`.cache/huggingface/`
- ImageBind 权重：`third_party/art2mus/.checkpoints/`
- 官方依赖组合：`diffusers==0.27.2`、`transformers==4.30.2`、`huggingface-hub==0.22.2`
- Apple Silicon / Metal 兼容补丁：MPS FP32 推理、CPU 随机数生成、图像投影层设备迁移，以及 MPS 张量排序
- 默认生成 3 个候选；ImageBind 排序后再用低频塌缩检测选择最终音频

### 生成任意图片

```bash
./run_art2mus.sh \
  "/absolute/path/to/artwork.jpg" \
  "outputs/art2mus/result.wav" \
  --seconds 10 \
  --steps 200 \
  --seed 0 \
  --candidates 3
```

首次运行需要下载约 13 GB 的 AudioLDM2 和 ImageBind 权重；之后会直接使用本地缓存。

对于容易生成低频 drone 的画面，可同时加入音乐性约束：

```bash
./run_art2mus.sh \
  "/absolute/path/to/artwork.jpg" \
  "outputs/art2mus/result.wav" \
  --prompt "melodic instrumental music, clear harmony, expressive rhythm" \
  --negative-prompt "low quality, noise, rumble, drone, distortion" \
  --keep-candidates
```

### 本次结果

输入图片：

`inputs/the-defiant-one.webp`

生成音频：

`outputs/art2mus/the-defiant-one_art2mus-4_10s_final.wav`

最终文件使用图片与音乐性文本联合条件，从 3 个候选中选择；音频格式为 16 kHz、单声道、32-bit float WAV，时长为 10 秒。
