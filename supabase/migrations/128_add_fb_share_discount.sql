-- Track Facebook share discount (10% platform-funded, reduces platform fee not installer revenue)
ALTER TABLE leads ADD COLUMN IF NOT EXISTS fb_share_discount NUMERIC(10,2) DEFAULT NULL;
