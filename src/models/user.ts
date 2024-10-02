// src/models/user.ts
export class User {
    id: string;
    name: string;
    email: string;
    password: string;
    ph_number: string;
    ph_number_verified: boolean;
    photo?: string;
    verified: boolean;
    subscriptionExpiry?: Date;
    role: string;
  
    constructor(
      id: string,
      name: string,
      email: string,
      password: string,
      ph_number: string,
      ph_number_verified: boolean,
      photo: string | null,
      verified: boolean,
      subscriptionExpiry: Date | null,
      role: string
    ) {
      this.id = id;
      this.name = name;
      this.email = email;
      this.password = password;
      this.ph_number = ph_number;
      this.ph_number_verified = ph_number_verified;
      this.photo = photo || undefined;
      this.verified = verified;
      this.subscriptionExpiry = subscriptionExpiry || undefined;
      this.role = role;
    }
  }
  