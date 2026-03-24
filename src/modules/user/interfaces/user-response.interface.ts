export interface MyProfileResponse {
  id: string;
  username: string;
  fullName: string;
  bio: string;
  profilePicture: string;
  postsCount: number;
  followersCount: number;
  followingCount: number;
  isPrivate: boolean;
}

export interface GetPostsResponse {
  posts: {
    id: string;
    imageUrl: string;
    createdAt: Date;
  }[];
  nextCursor: string | null;
  hasMore: boolean;
}