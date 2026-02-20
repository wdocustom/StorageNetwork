"use server";

import { createClient } from "@supabase/supabase-js";

// TODO: Implement Gemini automated moderation and quality scoring

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ═══════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════

export interface Community {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  icon_url: string | null;
  post_count: number;
  member_count: number;
  created_at: string;
}

export interface PostAuthor {
  id: string;
  first_name: string | null;
  business_name: string | null;
  avatar_url: string | null;
}

export interface PostImage {
  id: string;
  post_id: string;
  image_url: string;
  storage_path: string;
  sort_order: number;
  caption: string | null;
  created_at: string;
}

export interface Post {
  id: string;
  community_id: string;
  author_id: string;
  title: string;
  content: string;
  tags: string[];
  upvotes: number;
  downvotes: number;
  comment_count: number;
  ai_summary: string | null;
  is_pinned: boolean;
  created_at: string;
  author: PostAuthor;
  community: { name: string; slug: string };
  images?: PostImage[];
  user_vote?: number | null;
}

export interface Comment {
  id: string;
  post_id: string;
  author_id: string;
  parent_id: string | null;
  content: string;
  upvotes: number;
  downvotes: number;
  depth: number;
  created_at: string;
  author: PostAuthor;
  user_vote?: number | null;
  children?: Comment[];
}

const DEFAULT_COMMUNITIES = [
  { name: "General Discussion", slug: "general", description: "Open discussion about anything storage-related. Tips, tricks, and stories from the field." },
  { name: "Build Showcase", slug: "builds", description: "Show off your latest tote rack builds. Photos, dimensions, and proud moments." },
  { name: "Business Tips", slug: "business", description: "Grow your installer business. Marketing, pricing, customer management strategies." },
  { name: "Technical Help", slug: "tech-help", description: "Got a tricky build? Ask the community for advice on materials, techniques, and troubleshooting." },
  { name: "Feature Requests", slug: "features", description: "Suggest and vote on new features for the Storage Network platform." },
];

// ═══════════════════════════════════════════════════════════════════════════
// Community Actions
// ═══════════════════════════════════════════════════════════════════════════

export async function getCommunities(): Promise<Community[]> {
  const { data, error } = await supabase
    .from("communities")
    .select("*")
    .order("post_count", { ascending: false });

  if (error) {
    console.error("Failed to fetch communities:", error);
    return [];
  }

  // Auto-seed default spaces if the table is empty
  if (!data || data.length === 0) {
    const { error: seedError } = await supabase
      .from("communities")
      .upsert(DEFAULT_COMMUNITIES, { onConflict: "slug" });

    if (seedError) {
      console.error("Failed to seed communities:", seedError);
      return [];
    }

    const { data: seeded } = await supabase
      .from("communities")
      .select("*")
      .order("post_count", { ascending: false });

    return seeded || [];
  }

  return data;
}

export async function getCommunityBySlug(
  slug: string
): Promise<Community | null> {
  const { data, error } = await supabase
    .from("communities")
    .select("*")
    .eq("slug", slug)
    .single();

  if (error) return null;
  return data;
}

// ═══════════════════════════════════════════════════════════════════════════
// Post Actions
// ═══════════════════════════════════════════════════════════════════════════

export async function getPosts(options: {
  communitySlug?: string;
  feed?: "trending" | "latest" | "unanswered";
  limit?: number;
  offset?: number;
  userId?: string;
}): Promise<Post[]> {
  const { communitySlug, feed = "latest", limit = 20, offset = 0, userId } = options;

  let query = supabase
    .from("posts")
    .select(
      `
      *,
      author:profiles!posts_author_id_fkey(id, first_name, business_name, avatar_url),
      community:communities!posts_community_id_fkey(name, slug),
      images:post_images(id, post_id, image_url, storage_path, sort_order, caption, created_at)
    `
    )
    .range(offset, offset + limit - 1);

  // Filter by community
  if (communitySlug) {
    const community = await getCommunityBySlug(communitySlug);
    if (community) {
      query = query.eq("community_id", community.id);
    }
  }

  // Apply feed sorting
  switch (feed) {
    case "trending":
      query = query.order("upvotes", { ascending: false });
      break;
    case "unanswered":
      query = query.eq("comment_count", 0).order("created_at", { ascending: false });
      break;
    case "latest":
    default:
      query = query.order("is_pinned", { ascending: false }).order("created_at", { ascending: false });
      break;
  }

  const { data, error } = await query;

  if (error) {
    console.error("Failed to fetch posts:", error);
    return [];
  }

  let posts = (data || []) as Post[];

  // Attach current user's vote state
  if (userId && posts.length > 0) {
    const postIds = posts.map((p) => p.id);
    const { data: votes } = await supabase
      .from("votes")
      .select("post_id, vote_value")
      .eq("user_id", userId)
      .in("post_id", postIds);

    if (votes) {
      const voteMap = new Map(
        votes.map((v: { post_id: string; vote_value: number }) => [v.post_id, v.vote_value] as const)
      );
      posts = posts.map((p) => ({
        ...p,
        user_vote: (voteMap.get(p.id) as number | undefined) ?? null,
      }));
    }
  }

  return posts;
}

export async function getPostById(
  postId: string,
  userId?: string
): Promise<Post | null> {
  const { data, error } = await supabase
    .from("posts")
    .select(
      `
      *,
      author:profiles!posts_author_id_fkey(id, first_name, business_name, avatar_url),
      community:communities!posts_community_id_fkey(name, slug),
      images:post_images(id, post_id, image_url, storage_path, sort_order, caption, created_at)
    `
    )
    .eq("id", postId)
    .single();

  if (error || !data) return null;

  let post = data as Post;

  // Attach current user's vote state
  if (userId) {
    const { data: vote } = await supabase
      .from("votes")
      .select("vote_value")
      .eq("user_id", userId)
      .eq("post_id", postId)
      .maybeSingle();

    post = { ...post, user_vote: vote?.vote_value || null };
  }

  return post;
}

export async function createPost(input: {
  communityId: string;
  authorId: string;
  title: string;
  content: string;
  tags?: string[];
}): Promise<{ success: boolean; postId?: string; error?: string }> {
  const { communityId, authorId, title, content, tags = [] } = input;

  // Verify the user is Pro
  const { data: profile } = await supabase
    .from("profiles")
    .select("is_pro")
    .eq("id", authorId)
    .single();

  if (!profile?.is_pro) {
    return { success: false, error: "Pro subscription required to post." };
  }

  const { data, error } = await supabase
    .from("posts")
    .insert({
      community_id: communityId,
      author_id: authorId,
      title,
      content,
      tags,
    })
    .select("id")
    .single();

  if (error) {
    console.error("Failed to create post:", error);
    return { success: false, error: error.message };
  }

  return { success: true, postId: data.id };
}

// ═══════════════════════════════════════════════════════════════════════════
// Comment Actions
// ═══════════════════════════════════════════════════════════════════════════

export async function getComments(
  postId: string,
  userId?: string
): Promise<Comment[]> {
  const { data, error } = await supabase
    .from("comments")
    .select(
      `
      *,
      author:profiles!comments_author_id_fkey(id, first_name, business_name, avatar_url)
    `
    )
    .eq("post_id", postId)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Failed to fetch comments:", error);
    return [];
  }

  let flatComments = (data || []) as Comment[];

  // Attach current user's vote state
  if (userId && flatComments.length > 0) {
    const commentIds = flatComments.map((c) => c.id);
    const { data: votes } = await supabase
      .from("votes")
      .select("comment_id, vote_value")
      .eq("user_id", userId)
      .in("comment_id", commentIds);

    if (votes) {
      const voteMap = new Map(
        votes.map((v: { comment_id: string; vote_value: number }) => [v.comment_id, v.vote_value] as const)
      );
      flatComments = flatComments.map((c) => ({
        ...c,
        user_vote: (voteMap.get(c.id) as number | undefined) ?? null,
      }));
    }
  }

  // Build the nested tree structure for fast client reads
  return buildCommentTree(flatComments);
}

function buildCommentTree(comments: Comment[]): Comment[] {
  const map = new Map<string, Comment>();
  const roots: Comment[] = [];

  // First pass: index all comments
  for (const c of comments) {
    map.set(c.id, { ...c, children: [] });
  }

  // Second pass: build parent-child relationships
  for (const c of comments) {
    const node = map.get(c.id)!;
    if (c.parent_id && map.has(c.parent_id)) {
      map.get(c.parent_id)!.children!.push(node);
    } else {
      roots.push(node);
    }
  }

  return roots;
}

export async function createComment(input: {
  postId: string;
  authorId: string;
  content: string;
  parentId?: string | null;
}): Promise<{ success: boolean; commentId?: string; error?: string }> {
  const { postId, authorId, content, parentId } = input;

  // Verify the user is Pro
  const { data: profile } = await supabase
    .from("profiles")
    .select("is_pro")
    .eq("id", authorId)
    .single();

  if (!profile?.is_pro) {
    return { success: false, error: "Pro subscription required to comment." };
  }

  // Calculate depth from parent
  let depth = 0;
  if (parentId) {
    const { data: parent } = await supabase
      .from("comments")
      .select("depth")
      .eq("id", parentId)
      .single();
    if (parent) {
      depth = parent.depth + 1;
    }
  }

  const { data, error } = await supabase
    .from("comments")
    .insert({
      post_id: postId,
      author_id: authorId,
      content,
      parent_id: parentId || null,
      depth,
    })
    .select("id")
    .single();

  if (error) {
    console.error("Failed to create comment:", error);
    return { success: false, error: error.message };
  }

  return { success: true, commentId: data.id };
}

// ═══════════════════════════════════════════════════════════════════════════
// Vote Actions
// ═══════════════════════════════════════════════════════════════════════════

export async function vote(input: {
  userId: string;
  postId?: string;
  commentId?: string;
  value: 1 | -1;
}): Promise<{ success: boolean; error?: string }> {
  const { userId, postId, commentId, value } = input;

  if (!postId && !commentId) {
    return { success: false, error: "Must specify a post or comment to vote on." };
  }

  // Check for existing vote
  let existingQuery = supabase
    .from("votes")
    .select("id, vote_value")
    .eq("user_id", userId);

  if (postId) {
    existingQuery = existingQuery.eq("post_id", postId);
  } else {
    existingQuery = existingQuery.eq("comment_id", commentId!);
  }

  const { data: existing } = await existingQuery.maybeSingle();

  if (existing) {
    if (existing.vote_value === value) {
      // Same vote direction → remove the vote (toggle off)
      const { error: deleteError } = await supabase
        .from("votes")
        .delete()
        .eq("id", existing.id);

      if (deleteError) {
        return { success: false, error: deleteError.message };
      }

      // Update the denormalized count
      const table = postId ? "posts" : "comments";
      const targetId = postId || commentId!;
      const column = value === 1 ? "upvotes" : "downvotes";

      // Decrement the denormalized count directly
      const { data: currentRow } = await supabase
        .from(table)
        .select("upvotes, downvotes")
        .eq("id", targetId)
        .single();

      if (currentRow) {
        const row = currentRow as Record<string, number>;
        await supabase
          .from(table)
          .update({ [column]: Math.max(0, row[column] - 1) })
          .eq("id", targetId);
      }

      return { success: true };
    } else {
      // Different direction → update the vote
      const { error: updateError } = await supabase
        .from("votes")
        .update({ vote_value: value })
        .eq("id", existing.id);

      if (updateError) {
        return { success: false, error: updateError.message };
      }

      // Swap counts: decrement old, increment new
      const table = postId ? "posts" : "comments";
      const targetId = postId || commentId!;
      const oldColumn = existing.vote_value === 1 ? "upvotes" : "downvotes";
      const newColumn = value === 1 ? "upvotes" : "downvotes";

      // Swap counts: decrement old column, increment new column
      const { data: current } = await supabase
        .from(table)
        .select("upvotes, downvotes")
        .eq("id", targetId)
        .single();

      if (current) {
        const row = current as Record<string, number>;
        await supabase
          .from(table)
          .update({
            [oldColumn]: Math.max(0, row[oldColumn] - 1),
            [newColumn]: row[newColumn] + 1,
          })
          .eq("id", targetId);
      }

      return { success: true };
    }
  }

  // No existing vote → insert new
  const { error: insertError } = await supabase.from("votes").insert({
    user_id: userId,
    post_id: postId || null,
    comment_id: commentId || null,
    vote_value: value,
  });

  if (insertError) {
    return { success: false, error: insertError.message };
  }

  // Increment the denormalized count
  const table = postId ? "posts" : "comments";
  const targetId = postId || commentId!;
  const column = value === 1 ? "upvotes" : "downvotes";

  const { data: current } = await supabase
    .from(table)
    .select("upvotes, downvotes")
    .eq("id", targetId)
    .single();

  if (current) {
    const row = current as Record<string, number>;
    await supabase
      .from(table)
      .update({ [column]: row[column] + 1 })
      .eq("id", targetId);
  }

  return { success: true };
}

// ═══════════════════════════════════════════════════════════════════════════
// AI Summary Action
// ═══════════════════════════════════════════════════════════════════════════

export async function saveAiSummary(
  postId: string,
  summary: string
): Promise<{ success: boolean }> {
  const { error } = await supabase
    .from("posts")
    .update({ ai_summary: summary })
    .eq("id", postId);

  return { success: !error };
}

// ═══════════════════════════════════════════════════════════════════════════
// Post Image Actions
// ═══════════════════════════════════════════════════════════════════════════

const COMMUNITY_BUCKET = "community-images";

async function ensureCommunityBucket() {
  const { data } = await supabase.storage.getBucket(COMMUNITY_BUCKET);
  if (!data) {
    await supabase.storage.createBucket(COMMUNITY_BUCKET, {
      public: true,
      fileSizeLimit: 5 * 1024 * 1024, // 5MB
    });
  }
}

export async function uploadPostImage(
  postId: string,
  authorId: string,
  formData: FormData
): Promise<{ success: boolean; image?: PostImage; error?: string }> {
  try {
    const file = formData.get("image") as File | null;
    if (!file) {
      return { success: false, error: "No file provided." };
    }

    // Validate file type
    const allowed = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    if (!allowed.includes(file.type)) {
      return { success: false, error: "Only JPEG, PNG, WebP, and GIF images are allowed." };
    }

    // Validate file size (5MB)
    if (file.size > 5 * 1024 * 1024) {
      return { success: false, error: "Image must be under 5MB." };
    }

    // Verify user is pro and owns the post
    const { data: post } = await supabase
      .from("posts")
      .select("author_id")
      .eq("id", postId)
      .single();

    if (!post || post.author_id !== authorId) {
      return { success: false, error: "You can only add images to your own posts." };
    }

    await ensureCommunityBucket();

    const ext = file.name.split(".").pop() || "jpg";
    const storagePath = `${postId}/${Date.now()}.${ext}`;

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const { error: uploadError } = await supabase.storage
      .from(COMMUNITY_BUCKET)
      .upload(storagePath, buffer, {
        contentType: file.type,
        upsert: true,
      });

    if (uploadError) {
      console.error("[PostImage] Upload error:", uploadError);
      return { success: false, error: uploadError.message };
    }

    const { data: urlData } = supabase.storage
      .from(COMMUNITY_BUCKET)
      .getPublicUrl(storagePath);

    // Get current image count for sort_order
    const { count } = await supabase
      .from("post_images")
      .select("id", { count: "exact", head: true })
      .eq("post_id", postId);

    const { data: imageRow, error: insertError } = await supabase
      .from("post_images")
      .insert({
        post_id: postId,
        image_url: urlData.publicUrl,
        storage_path: storagePath,
        sort_order: count || 0,
      })
      .select("*")
      .single();

    if (insertError) {
      console.error("[PostImage] Insert error:", insertError);
      // Clean up uploaded file
      await supabase.storage.from(COMMUNITY_BUCKET).remove([storagePath]);
      return { success: false, error: insertError.message };
    }

    return { success: true, image: imageRow as PostImage };
  } catch (err) {
    console.error("[PostImage] Error:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Upload failed.",
    };
  }
}

export async function deletePostImage(
  imageId: string,
  authorId: string
): Promise<{ success: boolean; error?: string }> {
  // Get the image to verify ownership and get the storage path
  const { data: image } = await supabase
    .from("post_images")
    .select("*, post:posts!post_images_post_id_fkey(author_id)")
    .eq("id", imageId)
    .single();

  if (!image) {
    return { success: false, error: "Image not found." };
  }

  const postAuthorId = (image as any).post?.author_id;
  if (postAuthorId !== authorId) {
    return { success: false, error: "You can only delete images from your own posts." };
  }

  // Delete from storage
  await supabase.storage
    .from(COMMUNITY_BUCKET)
    .remove([image.storage_path]);

  // Delete from database
  const { error } = await supabase
    .from("post_images")
    .delete()
    .eq("id", imageId);

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true };
}

export async function getPostImages(postId: string): Promise<PostImage[]> {
  const { data, error } = await supabase
    .from("post_images")
    .select("*")
    .eq("post_id", postId)
    .order("sort_order", { ascending: true });

  if (error) {
    console.error("Failed to fetch post images:", error);
    return [];
  }

  return (data || []) as PostImage[];
}
