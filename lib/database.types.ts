// Tipos gerados a partir do SCHEMA_SUPABASE.sql
// Refletem a estrutura exata das 7 tabelas do banco Ative+60

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          full_name: string;
          email: string | null;
          phone: string | null;
          crefito: string | null;
          avatar_url: string | null;
          role: "gestao" | "fisio";
          repasse_value: number | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          full_name: string;
          email?: string | null;
          phone?: string | null;
          crefito?: string | null;
          avatar_url?: string | null;
          role?: "gestao" | "fisio";
          repasse_value?: number | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          full_name?: string;
          email?: string | null;
          phone?: string | null;
          crefito?: string | null;
          avatar_url?: string | null;
          role?: "gestao" | "fisio";
          repasse_value?: number | null;
          created_at?: string;
        };
        Relationships: [];
      };
      patients: {
        Row: {
          id: string;
          full_name: string;
          birth_date: string | null;
          cpf: string | null;
          phone: string | null;
          address: string | null;
          photo_url: string | null;
          family_contact_name: string | null;
          family_relationship: string | null;
          family_phone: string | null;
          family_email: string | null;
          primary_fisio_id: string | null;
          weekly_frequency: number | null;
          session_value: number | null;
          admission_date: string | null;
          primary_diagnosis: string | null;
          comorbidities: string | null;
          allergies: string | null;
          clinical_notes: string | null;
          tcle_signed: boolean;
          tcle_signed_at: string | null;
          commitment_signed: boolean;
          status: "active" | "paused" | "discharged";
          created_at: string;
        };
        Insert: {
          id?: string;
          full_name: string;
          birth_date?: string | null;
          cpf?: string | null;
          phone?: string | null;
          address?: string | null;
          photo_url?: string | null;
          family_contact_name?: string | null;
          family_relationship?: string | null;
          family_phone?: string | null;
          family_email?: string | null;
          primary_fisio_id?: string | null;
          weekly_frequency?: number | null;
          session_value?: number | null;
          admission_date?: string | null;
          primary_diagnosis?: string | null;
          comorbidities?: string | null;
          allergies?: string | null;
          clinical_notes?: string | null;
          tcle_signed?: boolean;
          tcle_signed_at?: string | null;
          commitment_signed?: boolean;
          status?: "active" | "paused" | "discharged";
          created_at?: string;
        };
        Update: {
          id?: string;
          full_name?: string;
          birth_date?: string | null;
          cpf?: string | null;
          phone?: string | null;
          address?: string | null;
          photo_url?: string | null;
          family_contact_name?: string | null;
          family_relationship?: string | null;
          family_phone?: string | null;
          family_email?: string | null;
          primary_fisio_id?: string | null;
          weekly_frequency?: number | null;
          session_value?: number | null;
          admission_date?: string | null;
          primary_diagnosis?: string | null;
          comorbidities?: string | null;
          allergies?: string | null;
          clinical_notes?: string | null;
          tcle_signed?: boolean;
          tcle_signed_at?: string | null;
          commitment_signed?: boolean;
          status?: "active" | "paused" | "discharged";
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "patients_primary_fisio_id_fkey";
            columns: ["primary_fisio_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      medications: {
        Row: {
          id: string;
          patient_id: string;
          name: string;
          dosage: string | null;
          frequency: string | null;
          notes: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          patient_id: string;
          name: string;
          dosage?: string | null;
          frequency?: string | null;
          notes?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          patient_id?: string;
          name?: string;
          dosage?: string | null;
          frequency?: string | null;
          notes?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "medications_patient_id_fkey";
            columns: ["patient_id"];
            isOneToOne: false;
            referencedRelation: "patients";
            referencedColumns: ["id"];
          },
        ];
      };
      appointments: {
        Row: {
          id: string;
          patient_id: string;
          fisio_id: string;
          scheduled_date: string;
          scheduled_time: string | null;
          check_in_at: string | null;
          check_out_at: string | null;
          status: "scheduled" | "in_progress" | "completed" | "missed" | "cancelled";
          reschedule_reason: string | null;
          reschedule_notes: string | null;
          rescheduled_to: string | null;
          cascade_pair_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          patient_id: string;
          fisio_id: string;
          scheduled_date: string;
          scheduled_time?: string | null;
          check_in_at?: string | null;
          check_out_at?: string | null;
          status?: "scheduled" | "in_progress" | "completed" | "missed" | "cancelled";
          reschedule_reason?: string | null;
          reschedule_notes?: string | null;
          rescheduled_to?: string | null;
          cascade_pair_id?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          patient_id?: string;
          fisio_id?: string;
          scheduled_date?: string;
          scheduled_time?: string | null;
          check_in_at?: string | null;
          check_out_at?: string | null;
          status?: "scheduled" | "in_progress" | "completed" | "missed" | "cancelled";
          reschedule_reason?: string | null;
          reschedule_notes?: string | null;
          rescheduled_to?: string | null;
          cascade_pair_id?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "appointments_patient_id_fkey";
            columns: ["patient_id"];
            isOneToOne: false;
            referencedRelation: "patients";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "appointments_fisio_id_fkey";
            columns: ["fisio_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      evolutions: {
        Row: {
          id: string;
          appointment_id: string | null;
          patient_id: string;
          fisio_id: string;
          bp_initial: string | null;
          bp_final: string | null;
          hr_initial: number | null;
          hr_final: number | null;
          spo2_initial: number | null;
          spo2_final: number | null;
          rr_initial: number | null;
          rr_final: number | null;
          conducts: string[] | null;
          observations: string | null;
          had_intercurrence: boolean;
          intercurrence_description: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          appointment_id?: string | null;
          patient_id: string;
          fisio_id: string;
          bp_initial?: string | null;
          bp_final?: string | null;
          hr_initial?: number | null;
          hr_final?: number | null;
          spo2_initial?: number | null;
          spo2_final?: number | null;
          rr_initial?: number | null;
          rr_final?: number | null;
          conducts?: string[] | null;
          observations?: string | null;
          had_intercurrence?: boolean;
          intercurrence_description?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          appointment_id?: string | null;
          patient_id?: string;
          fisio_id?: string;
          bp_initial?: string | null;
          bp_final?: string | null;
          hr_initial?: number | null;
          hr_final?: number | null;
          spo2_initial?: number | null;
          spo2_final?: number | null;
          rr_initial?: number | null;
          rr_final?: number | null;
          conducts?: string[] | null;
          observations?: string | null;
          had_intercurrence?: boolean;
          intercurrence_description?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "evolutions_appointment_id_fkey";
            columns: ["appointment_id"];
            isOneToOne: false;
            referencedRelation: "appointments";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "evolutions_patient_id_fkey";
            columns: ["patient_id"];
            isOneToOne: false;
            referencedRelation: "patients";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "evolutions_fisio_id_fkey";
            columns: ["fisio_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      exams: {
        Row: {
          id: string;
          patient_id: string;
          name: string;
          exam_date: string | null;
          file_url: string | null;
          notes: string | null;
          uploaded_at: string;
        };
        Insert: {
          id?: string;
          patient_id: string;
          name: string;
          exam_date?: string | null;
          file_url?: string | null;
          notes?: string | null;
          uploaded_at?: string;
        };
        Update: {
          id?: string;
          patient_id?: string;
          name?: string;
          exam_date?: string | null;
          file_url?: string | null;
          notes?: string | null;
          uploaded_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "exams_patient_id_fkey";
            columns: ["patient_id"];
            isOneToOne: false;
            referencedRelation: "patients";
            referencedColumns: ["id"];
          },
        ];
      };
      monthly_reports: {
        Row: {
          id: string;
          patient_id: string;
          reference_month: string;
          pdf_url: string | null;
          sent_to_family_at: string | null;
          generated_at: string;
        };
        Insert: {
          id?: string;
          patient_id: string;
          reference_month: string;
          pdf_url?: string | null;
          sent_to_family_at?: string | null;
          generated_at?: string;
        };
        Update: {
          id?: string;
          patient_id?: string;
          reference_month?: string;
          pdf_url?: string | null;
          sent_to_family_at?: string | null;
          generated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "monthly_reports_patient_id_fkey";
            columns: ["patient_id"];
            isOneToOne: false;
            referencedRelation: "patients";
            referencedColumns: ["id"];
          },
        ];
      };
      billing_status: {
        Row: {
          id: string;
          patient_id: string;
          reference_month: string;
          status: "open" | "paid";
          marked_paid_at: string | null;
          marked_by: string | null;
          notes: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          patient_id: string;
          reference_month: string;
          status?: "open" | "paid";
          marked_paid_at?: string | null;
          marked_by?: string | null;
          notes?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          patient_id?: string;
          reference_month?: string;
          status?: "open" | "paid";
          marked_paid_at?: string | null;
          marked_by?: string | null;
          notes?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      payroll_status: {
        Row: {
          id: string;
          fisio_id: string;
          reference_month: string;
          status: "open" | "paid";
          marked_paid_at: string | null;
          marked_by: string | null;
          notes: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          fisio_id: string;
          reference_month: string;
          status?: "open" | "paid";
          marked_paid_at?: string | null;
          marked_by?: string | null;
          notes?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          fisio_id?: string;
          reference_month?: string;
          status?: "open" | "paid";
          marked_paid_at?: string | null;
          marked_by?: string | null;
          notes?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      role_profile: "gestao" | "fisio";
      status_patient: "active" | "paused" | "discharged";
      status_appointment: "scheduled" | "in_progress" | "completed" | "missed" | "cancelled";
    };
    CompositeTypes: Record<string, never>;
  };
};
