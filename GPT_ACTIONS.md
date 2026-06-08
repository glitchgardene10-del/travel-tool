# GPT Actions 設定

這條路線不呼叫 OpenAI API，所以不會用你的 API token。ChatGPT 會用你的 ChatGPT 方案來思考；這個網站只提供行程資料的讀取與寫回 API。

## 使用流程

1. 把網站部署到 Netlify。
2. 在手機工具裡點「GPT」。
3. 確認 API 網址是你的 Netlify 網址。
4. 點「上傳行程」。
5. 建立一個 Custom GPT。
6. 在 GPT 的 Actions 貼上 `gpt-action-openapi.yaml`。
7. 把 schema 裡的 `https://YOUR-NETLIFY-SITE.netlify.app` 改成你的 Netlify 網址。
8. Authentication 選 `None`。
9. 在 GPT instructions 加上：

```text
你是我的旅遊行程助手。當我提供 Trip ID 和 PIN 後，請先用 getTrip 讀取行程，再依我的需求重新安排。你可以調整 dayIndex、time、type、name、address、cost、currency、url、note。更新時用 updateTrip 寫回完整 trip JSON。除非我要求刪除，否則保留既有項目。行程要務實，避免太趕，並補上交通、用餐、休息空檔。
```

## 對 GPT 說的第一次話

```text
我的 Trip ID 是 trip_xxxxxxxx，PIN 是 123456。請先讀取我的行程，之後都直接幫我更新這份行程。
```

這是一次性配對，不是每次都要複製 prompt。之後可以直接說：

```text
幫我把 Day 2 排得輕鬆一點，晚餐前回飯店。
```

GPT 寫回後，回到旅遊工具點「GPT」→「抓回行程」。

## 注意

- PIN 是簡易配對，不是高安全帳號系統，不要放護照完整號碼或信用卡資料。
- 如果你換了 Trip ID 或 PIN，要重新上傳並告訴 GPT 新的配對碼。
- Netlify Free 有用量上限，但官方說 Free plan 是硬限制，不會自動爆帳單。
