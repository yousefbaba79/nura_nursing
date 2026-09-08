import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const email = process.env.SEED_EMAIL || "consultant@example.com";
  const password = process.env.SEED_PASSWORD || "ChangeMe123!";

  const existing = await prisma.consultant.findUnique({ where: { email } });
  if (existing) {
    console.log(`Consultant ${email} already exists, skipping seed.`);
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const consultant = await prisma.consultant.create({
    data: {
      email,
      passwordHash,
      fullName: "Jordan Avery",
      professionalTitle: "IBCLC, Lactation Consultant",
      clinicName: "Nura Lactation Care",
      phone: "555-0100",
    },
  });

  console.log(`Seeded consultant account: ${email} / ${password}`);
  console.log(`Consultant id: ${consultant.id}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
