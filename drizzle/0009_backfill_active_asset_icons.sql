UPDATE "assets"
SET "logo_url" = CASE "id"
  WHEN 'berachain-bera' THEN 'https://coin-images.coingecko.com/coins/images/25235/thumb/BERA.png'
  WHEN 'aevo-exchange' THEN 'https://coin-images.coingecko.com/coins/images/35893/thumb/aevo.png'
  WHEN 'rejuve-ai' THEN 'https://coin-images.coingecko.com/coins/images/29366/thumb/2023_Rejuve_Logo_-_Square_-_Teal.jpg'
  WHEN 'fetch-ai' THEN 'https://coin-images.coingecko.com/coins/images/5681/large/Fetch.jpg?1696506140'
  ELSE "logo_url"
END
WHERE "id" IN ('berachain-bera', 'aevo-exchange', 'rejuve-ai', 'fetch-ai');
