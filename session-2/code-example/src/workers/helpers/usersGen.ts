import type { User } from "../types/user.type.ts";

export function userGen(count: number): User[] {
  return Array.from({ length: count }, (_, i) => ({
    name: `User ${i + 1}`,
    id: i + 1,
    email: `user${i + 1}@example.com`,
  }));
}
