-- Migration: Add missing columns to offers table
-- Run this in Supabase → SQL Editor BEFORE committing Module 3 + 4 code

-- Add all columns that Module 3's Irresistible Offer Builder saves
ALTER TABLE offers ADD COLUMN IF NOT EXISTS target_market TEXT;
ALTER TABLE offers ADD COLUMN IF NOT EXISTS core_problem TEXT;
ALTER TABLE offers ADD COLUMN IF NOT EXISTS unique_mechanism TEXT;
ALTER TABLE offers ADD COLUMN IF NOT EXISTS ebook_title TEXT;
ALTER TABLE offers ADD COLUMN IF NOT EXISTS transformation TEXT;
ALTER TABLE offers ADD COLUMN IF NOT EXISTS ebook_value INTEGER;
ALTER TABLE offers ADD COLUMN IF NOT EXISTS price_justification TEXT;
ALTER TABLE offers ADD COLUMN IF NOT EXISTS offer_statement TEXT;
