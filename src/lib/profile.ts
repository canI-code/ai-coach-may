export const MANDATORY_PROFILE_FIELDS = ['username', 'education', 'interests'] as const;

export interface UserProfile {
  _id?: any;
  userId: any;
  fullName: string;
  dob: string;
  username?: string;
  education?: {
    degree: string;
    course: string;
    currentMarks: string;
  };
  interests?: string[];
  mainField?: string;
  completed: boolean;
  assessmentCompleted?: boolean;
  completedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export function evaluateProfileCompletion(profile: Partial<UserProfile>) {
  const pendingFields: string[] = [];

  if (!profile.username) {
    pendingFields.push('username');
  }

  const hasEducation = profile.education &&
                       profile.education.degree &&
                       profile.education.course &&
                       profile.education.currentMarks;
  if (!hasEducation) {
    pendingFields.push('education');
  }

  const hasInterests = profile.interests &&
                       Array.isArray(profile.interests) &&
                       profile.interests.length >= 3; // Spec says minimum 3 interests
  if (!hasInterests) {
    pendingFields.push('interests');
  }

  return {
    isComplete: pendingFields.length === 0,
    pendingFields
  };
}
