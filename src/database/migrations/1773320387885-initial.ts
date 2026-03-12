import { MigrationInterface, QueryRunner } from "typeorm";

export class Initial1773320387885 implements MigrationInterface {
    name = 'Initial1773320387885'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."auth_attempts_attempttype_enum" AS ENUM('signup', 'login', 'forgot_password')`);
        await queryRunner.query(`CREATE TYPE "public"."auth_attempts_status_enum" AS ENUM('invalid_user', 'wrong_password', 'user_already_exists')`);
        await queryRunner.query(`CREATE TABLE "auth_attempts" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "email" character varying, "phone" character varying, "attemptType" "public"."auth_attempts_attempttype_enum" NOT NULL, "status" "public"."auth_attempts_status_enum" NOT NULL, CONSTRAINT "PK_d9115e02f18808834eb82b4a297" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_3915da149ef6fe111c55a772c7" ON "auth_attempts" ("email") `);
        await queryRunner.query(`CREATE INDEX "IDX_2f7ebdba0e82a17e6db7b1fbb2" ON "auth_attempts" ("phone") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_2f7ebdba0e82a17e6db7b1fbb2"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_3915da149ef6fe111c55a772c7"`);
        await queryRunner.query(`DROP TABLE "auth_attempts"`);
        await queryRunner.query(`DROP TYPE "public"."auth_attempts_status_enum"`);
        await queryRunner.query(`DROP TYPE "public"."auth_attempts_attempttype_enum"`);
    }

}
