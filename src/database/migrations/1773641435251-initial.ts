import { MigrationInterface, QueryRunner } from "typeorm";

export class Initial1773641435251 implements MigrationInterface {
    name = 'Initial1773641435251'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "user_sessions" DROP CONSTRAINT "FK_e9658e959c490b0a634dfc54783"`);
        await queryRunner.query(`ALTER TABLE "users" ADD "facebookId" character varying`);
        await queryRunner.query(`ALTER TABLE "users" ADD CONSTRAINT "UQ_f9740e1e654a5daddb82c60bd75" UNIQUE ("facebookId")`);
        await queryRunner.query(`CREATE TYPE "public"."users_provider_enum" AS ENUM('local', 'facebook')`);
        await queryRunner.query(`ALTER TABLE "users" ADD "provider" "public"."users_provider_enum" NOT NULL DEFAULT 'local'`);
        await queryRunner.query(`CREATE TYPE "public"."user_sessions_loginprovider_enum" AS ENUM('local', 'facebook')`);
        await queryRunner.query(`ALTER TABLE "user_sessions" ADD "loginProvider" "public"."user_sessions_loginprovider_enum" NOT NULL DEFAULT 'local'`);
        await queryRunner.query(`CREATE INDEX "IDX_fe0bb3f6520ee0469504521e71" ON "users" ("username") `);
        await queryRunner.query(`CREATE INDEX "IDX_a31e0b412938f358466a7734ce" ON "user_sessions" ("sessionId", "isActive") `);
        await queryRunner.query(`ALTER TABLE "user_sessions" ADD CONSTRAINT "FK_e9658e959c490b0a634dfc54783" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "user_sessions" DROP CONSTRAINT "FK_e9658e959c490b0a634dfc54783"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_a31e0b412938f358466a7734ce"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_fe0bb3f6520ee0469504521e71"`);
        await queryRunner.query(`ALTER TABLE "user_sessions" DROP COLUMN "loginProvider"`);
        await queryRunner.query(`DROP TYPE "public"."user_sessions_loginprovider_enum"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "provider"`);
        await queryRunner.query(`DROP TYPE "public"."users_provider_enum"`);
        await queryRunner.query(`ALTER TABLE "users" DROP CONSTRAINT "UQ_f9740e1e654a5daddb82c60bd75"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "facebookId"`);
        await queryRunner.query(`ALTER TABLE "user_sessions" ADD CONSTRAINT "FK_e9658e959c490b0a634dfc54783" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

}
