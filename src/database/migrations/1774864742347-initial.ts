import { MigrationInterface, QueryRunner } from "typeorm";

export class Initial1774864742347 implements MigrationInterface {
    name = 'Initial1774864742347'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" ADD "website" character varying`);
        await queryRunner.query(`ALTER TABLE "users" ADD "pronouns" character varying`);
        await queryRunner.query(`CREATE TYPE "public"."users_accounttype_enum" AS ENUM('personal', 'creator', 'business')`);
        await queryRunner.query(`ALTER TABLE "users" ADD "accountType" "public"."users_accounttype_enum"`);
        await queryRunner.query(`ALTER TABLE "users" ADD "interests" text array NOT NULL DEFAULT '{}'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "interests"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "accountType"`);
        await queryRunner.query(`DROP TYPE "public"."users_accounttype_enum"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "pronouns"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "website"`);
    }
}