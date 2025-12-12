
export enum Language {
  ENGLISH = 'en',
  URDU = 'ur'
}

export enum JobType {
  FULL_TIME = 'Full Time',
  PART_TIME = 'Part Time',
  CONTRACT = 'Contract',
  DAILY_WAGE = 'Daily Wage'
}

export interface Job {
  id: string;
  title: string;
  company: string;
  locationName: string;
  salary: string;
  type: JobType;
  postedAt: string; // ISO date or "2h ago"
  description: string;
  requirements: string[];
  benefits?: string[];
  lat: number;
  lng: number;
  isVerified: boolean;
  category: string;
  contactPhone?: string;
  isPremium?: boolean;
}

export interface UserProfile {
  name: string;
  phone: string;
  email: string;
  gender: string;
  age: string;
  city: string;
  address: string;
  educationLevel: string; // Matric, Inter, Bachelors...
  education: string;
  languages: string[];
  categoryPreference: string;
  skills: string[];
  experience: string;
  preferredSalary: string;
  shiftPreference: string; // Morning, Evening, Night
  hasTransport: boolean;
  isVerified?: boolean;
  hasVideoResume?: boolean;
}

export interface FilterState {
  category: string;
  onlyPartTime: boolean;
  minSalary: number;
  onlyNearMe: boolean;
}

export interface Coordinates {
  latitude: number;
  longitude: number;
}

export interface Course {
  id: string;
  title: string;
  provider: string;
  duration: string;
  category: string;
  color: string;
}

export interface Applicant {
  id: string;
  name: string;
  role: string;
  matchScore: number;
  appliedAt: string;
  status: 'Pending' | 'Shortlisted' | 'Rejected';
}

export type ApplicationStatus = 'Applied' | 'Seen' | 'Shortlisted' | 'Rejected';

export interface AppliedJob extends Job {
  status: ApplicationStatus;
  appliedDate: string;
}

export type ScreenName = 'onboarding' | 'profileSetup' | 'home' | 'jobDetails' | 'cvBuilder' | 'postJob' | 'aiMatch' | 'profile' | 'learn' | 'employerDashboard' | 'applicants' | 'jobsApplied';
