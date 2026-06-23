import { createServerClient } from '@/lib/supabase/server';
import Shell from '@/components/Shell';
import CustomSectionClient from './CustomSectionClient';
import { notFound } from 'next/navigation';

export default async function CustomSectionPage({ params }: { params: { id: string } }) {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user?.id).single();

  const { data: section } = await supabase.from('custom_sections').select('*').eq('id', params.id).single();
  if (!section) notFound();

  const { data: fields } = await supabase.from('custom_fields').select('*').eq('section_id', params.id).order('display_order');
  const { data: records } = await supabase.from('custom_records').select('*').eq('section_id', params.id).order('created_at', { ascending: false });

  return (
    <Shell current={`/sections/${params.id}`} profile={profile}>
      <CustomSectionClient section={section} initialFields={fields || []} initialRecords={records || []} />
    </Shell>
  );
}
