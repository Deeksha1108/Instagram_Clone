export interface UserProfileResponse {
  id: string;
  username: string;
  fullName: string;
  stats: {
    posts: number;
    followers: number;
    following: number;
  };
}