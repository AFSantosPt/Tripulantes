import fs from "fs/promises";
import path from "path";
import { hashPassword } from "./hash";
import { newId } from "./id";

const DATA_DIR = path.join(process.cwd(), "data");
const MEMBERS_FILE = path.join(DATA_DIR, "members.json");

const DEFAULT_ADMIN = {
  name: "André Santos",
  crewId: "180939",
  password: "andres91",
};

export type AccountStatus = "pending" | "active";
export type CrewCategory = "guarda-freio" | "motorista" | "outro";

export interface CrewMember {
  id: string;
  name: string;
  crewId: string;
  passwordHash: string;
  status: AccountStatus;
  isAdmin: boolean;
  categories: CrewCategory[];
  createdAt: string;
  approvedAt?: string;
  approvedById?: string;
}

async function ensureDataDir(): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
}

export async function readMembers(): Promise<CrewMember[]> {
  await ensureDataDir();
  try {
    const raw = await fs.readFile(MEMBERS_FILE, "utf8");
    return JSON.parse(raw) as CrewMember[];
  } catch {
    return [];
  }
}

export async function writeMembers(members: CrewMember[]): Promise<void> {
  await ensureDataDir();
  await fs.writeFile(MEMBERS_FILE, JSON.stringify(members, null, 2), "utf8");
}

export async function seedAdminIfEmpty(): Promise<void> {
  const members = await readMembers();
  if (members.length === 0) {
    const seed: CrewMember = {
      id: newId(),
      name: DEFAULT_ADMIN.name,
      crewId: DEFAULT_ADMIN.crewId,
      passwordHash: hashPassword(DEFAULT_ADMIN.password),
      status: "active",
      isAdmin: true,
      categories: ["motorista"],
      createdAt: new Date().toISOString(),
      approvedAt: new Date().toISOString(),
    };
    await writeMembers([seed]);
  }
}

export function sanitize(m: CrewMember): Omit<CrewMember, "passwordHash"> {
  const { passwordHash: _ph, ...rest } = m;
  return rest;
}
