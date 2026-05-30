export interface UserResponse {
  id: string;
  username: string;
  email: string;
  avatarUrl: string | null;
  phone: string | null;
  bio: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
}
