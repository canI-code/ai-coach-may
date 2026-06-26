import { ObjectId } from 'mongodb';

export interface PracticeCampaignDoc {
  _id?: ObjectId;
  title: string;
  type: 'interview' | 'exam';
  batchId: ObjectId;
  startTime: Date;
  endTime: Date;
  durationMinutes: number;
  config: {
    role?: string;
    difficulty?: number;
    tags?: string[];
  };
  createdAt: Date;
}
