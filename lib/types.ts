import type { Database } from "./database.types";

// Tipos de domínio derivados das tabelas
export type Profile = Database["public"]["Tables"]["profiles"]["Row"];
export type Patient = Database["public"]["Tables"]["patients"]["Row"];
export type Medication = Database["public"]["Tables"]["medications"]["Row"];
export type Appointment = Database["public"]["Tables"]["appointments"]["Row"];
export type Evolution = Database["public"]["Tables"]["evolutions"]["Row"];
export type Exam = Database["public"]["Tables"]["exams"]["Row"];
export type MonthlyReport = Database["public"]["Tables"]["monthly_reports"]["Row"];
export type BillingStatus = Database["public"]["Tables"]["billing_status"]["Row"];
export type PayrollStatus = Database["public"]["Tables"]["payroll_status"]["Row"];

// Enums
export type RoleProfile = Database["public"]["Enums"]["role_profile"];
export type StatusPatient = Database["public"]["Enums"]["status_patient"];
export type StatusAppointment = Database["public"]["Enums"]["status_appointment"];
