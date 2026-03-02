# Task: 图片EXIF信息编辑器

## Plan
- [x] 基础布局与路由设置
  - [x] 更新 `src/routes.tsx`
  - [x] 创建 `src/components/layout/AppLayout.tsx`
- [x] EXIF 工具类编写 (`src/lib/exif-utils.ts`)
  - [x] 处理 Base64 图片读取
  - [x] GPS 坐标转换 (Decimal to DMS, DMS to Decimal)
  - [x] EXIF 数据读取与显示格式化
  - [x] EXIF 数据更新与写入
- [x] 首页 `src/pages/Home.tsx` 页面开发
  - [x] 图片上传与拖拽区
  - [x] 图片预览
  - [x] EXIF 信息展示表格
  - [x] GPS 编辑表单
  - [x] 下载保存逻辑
- [x] 最终样式与交互优化
- [x] 代码质量检查与 Lint

## Notes
- `piexifjs` 库用于处理 EXIF 的读取和写入。
- 修改 GPS 需要处理度分秒 (DMS) 格式。
- 下载时需要保持原图质量（piexifjs 支持）。
- 此项目为纯前端实现。
