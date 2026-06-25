-- ============================================================
-- NEXUS HR — Phase 3: Company Brain
-- Run AFTER 08_platform_foundation.sql
-- ============================================================

-- Stores uploaded documents
CREATE TABLE IF NOT EXISTS brain_documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID REFERENCES company_profile(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  document_type TEXT DEFAULT 'policy',
  -- policy | labour_law | sop | contract | client_requirement | other
  file_name TEXT,
  file_size INTEGER,
  content TEXT, -- extracted text content
  ai_summary TEXT, -- AI-generated summary
  ai_key_points JSONB DEFAULT '[]', -- extracted key rules as array
  version INTEGER DEFAULT 1,
  uploaded_by TEXT,
  uploaded_at TIMESTAMPTZ DEFAULT NOW()
);

-- Stores chunked content for better AI retrieval
CREATE TABLE IF NOT EXISTS brain_chunks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  document_id UUID REFERENCES brain_documents(id) ON DELETE CASCADE,
  company_id UUID REFERENCES company_profile(id) ON DELETE CASCADE,
  chunk_text TEXT NOT NULL,
  chunk_index INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Stores Q&A history so users can reference past answers
CREATE TABLE IF NOT EXISTS brain_conversations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID REFERENCES company_profile(id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  sources JSONB DEFAULT '[]', -- which documents were referenced
  asked_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE brain_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE brain_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE brain_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "brain_docs_access" ON brain_documents
  FOR ALL USING (company_id = public.user_company_id());

CREATE POLICY "brain_chunks_access" ON brain_chunks
  FOR ALL USING (company_id = public.user_company_id());

CREATE POLICY "brain_conv_access" ON brain_conversations
  FOR ALL USING (company_id = public.user_company_id());
