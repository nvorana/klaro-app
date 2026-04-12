-- Migration: Add Module 4 columns to sales_pages table
-- Run this in Supabase → SQL Editor

-- Add sections JSONB column (stores all 10 generated sections as key-value)
ALTER TABLE sales_pages ADD COLUMN IF NOT EXISTS sections JSONB;

-- Add headline TEXT column (the headline the student chose)
ALTER TABLE sales_pages ADD COLUMN IF NOT EXISTS headline TEXT;

-- Add headline_options TEXT column (JSON string of the 3 options + recommended)
ALTER TABLE sales_pages ADD COLUMN IF NOT EXISTS headline_options TEXT;
