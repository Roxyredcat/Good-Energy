import { createClient } from '@supabase/supabase-js';

const url = process.env.VITE_SUPABASE_URL || 'https://pvzixnoizskzywsmkcij.supabase.co';
const key = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB2eml4bm9penNrenl3c21rY2lqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU3MTY1NzMsImV4cCI6MjA4MTI5MjU3M30.P3xnjT9yqaSpAd8k2fi8Oo--Ds1gTOXJxF4OpcjgFdM';

const supabase = createClient(url, key);

async function run() {
  try {
    const marker = `good-energy-forum-test-${Date.now()}`;
    console.log('Marker:', marker);

    console.log('Inserting test post...');
    const { data: postData, error: postError } = await supabase
      .from('forum_posts')
      .insert([{ question: `TEST ${marker}`, author_id: null }])
      .select('*');
    if (postError) throw postError;
    const post = postData?.[0];
    console.log('Inserted post id:', post?.id);

    console.log('Inserting test answer...');
    const { data: ansData, error: ansError } = await supabase
      .from('forum_answers')
      .insert([{ post_id: post.id, text: `Answer ${marker}`, author_id: null }])
      .select('*');
    if (ansError) throw ansError;
    console.log('Inserted answer id:', ansData?.[0]?.id);

    console.log('Fetching post with answers...');
    const { data: fetched, error: fetchErr } = await supabase
      .from('forum_posts')
      .select('id,question,created_at,forum_answers(id,post_id,text,created_at)')
      .eq('id', post.id);
    if (fetchErr) throw fetchErr;
    console.log('Fetched result:', JSON.stringify(fetched, null, 2));

    console.log('Cleaning up test rows...');
    await supabase.from('forum_answers').delete().eq('post_id', post.id);
    await supabase.from('forum_posts').delete().eq('id', post.id);
    console.log('Cleanup complete. Test successful.');
    process.exit(0);
  } catch (e) {
    console.error('Forum test failed:', e.message || e);
    process.exit(2);
  }
}

run();
