-- Seed default community spaces if they don't already exist
insert into public.communities (name, slug, description) values
  ('General Discussion', 'general', 'Open discussion about anything storage-related. Tips, tricks, and stories from the field.'),
  ('Build Showcase', 'builds', 'Show off your latest tote rack builds. Photos, dimensions, and proud moments.'),
  ('Business Tips', 'business', 'Grow your installer business. Marketing, pricing, customer management strategies.'),
  ('Technical Help', 'tech-help', 'Got a tricky build? Ask the community for advice on materials, techniques, and troubleshooting.'),
  ('Feature Requests', 'features', 'Suggest and vote on new features for the Storage Network platform.')
on conflict (slug) do nothing;
