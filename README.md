# 旅遊神器

手機優先的旅遊規劃與查詢 PWA。可以部署成免費 HTTPS 網址，用 iPhone Safari 開啟後加入主畫面，不需要 App Store 審核。

## 本機測試

在專案資料夾啟動靜態伺服器：

```bash
python3 -m http.server 5173
```

然後打開：

```text
http://localhost:5173
```

iPhone 和電腦在同一個 Wi-Fi 時，可以用電腦的區網 IP 開啟，例如：

```text
http://192.168.1.23:5173
```

## 部署

最快方式是丟到 Vercel、Netlify 或 GitHub Pages。部署完成後會得到免費網址，例如：

```text
https://travel-tool-eason.vercel.app
```

iPhone 使用 Safari 開啟該網址，點分享按鈕，選「加入主畫面」。

## 旅途中使用

- 行程資料存在手機瀏覽器本機儲存。
- 之前開過的頁面會被 PWA 快取，離線時仍可看已存行程。
- 地圖、外部連結與即時查詢仍需要網路。
- 出國前請按「匯出」備份 JSON 檔。
