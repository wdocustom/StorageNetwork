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
  return data || [];
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
      community:communities!posts_community_id_fkey(name, slug)
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
      community:communities!posts_community_id_fkey(name, slug)
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
