UPDATE "assets"
SET "logo_url" = CASE "id"
  WHEN 'bitcoin' THEN 'https://assets.coingecko.com/coins/images/1/large/bitcoin.png?1696501400'
  WHEN 'ethereum' THEN 'https://assets.coingecko.com/coins/images/279/large/ethereum.png?1696501628'
  WHEN 'solana' THEN 'https://assets.coingecko.com/coins/images/4128/large/solana.png?1696504756'
  WHEN 'tether' THEN 'https://assets.coingecko.com/coins/images/325/large/Tether.png?1696501661'
  WHEN 'usd-coin' THEN 'https://assets.coingecko.com/coins/images/6319/large/usdc.png?1696506694'
  ELSE "logo_url"
END
WHERE "id" IN ('bitcoin', 'ethereum', 'solana', 'tether', 'usd-coin');
