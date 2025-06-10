// Type pour les notes
export type Note = {
  id: number;
  title: string;
  content: string;
  createdAt: string;
  status: 'active' | 'completed';
  priority: 'high' | 'medium' | 'low';
  tags: string[];
}
