import { MigrationInterface, QueryRunner } from "typeorm";

export class Initial1774622080885 implements MigrationInterface {
    name = 'Initial1774622080885'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "post_tags" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "user_id" uuid NOT NULL, "post_id" uuid NOT NULL, CONSTRAINT "PK_0c750579b992a52b24d18ec3431" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_0af861616219606ea6f610b3f8" ON "post_tags" ("user_id", "post_id") `);
        await queryRunner.query(`CREATE TABLE "posts" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "user_id" uuid NOT NULL, "imageUrl" character varying NOT NULL, CONSTRAINT "PK_2829ac61eff60fcec60d7274b9e" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_300215aa4b0de9f1d5111678ed" ON "posts" ("user_id", "createdAt", "id") `);
        await queryRunner.query(`CREATE TABLE "saved_posts" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "user_id" uuid NOT NULL, "post_id" uuid NOT NULL, CONSTRAINT "PK_868375ca4f041a2337a1c1a6634" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_837a562f71fec3009c9af77ee5" ON "saved_posts" ("user_id", "post_id") `);
        await queryRunner.query(`CREATE TABLE "follows" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "followerId" uuid NOT NULL, "followingId" uuid NOT NULL, CONSTRAINT "PK_8988f607744e16ff79da3b8a627" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_0b6f3ce73b6bdf8a2e99b6ef83" ON "follows" ("followerId", "createdAt", "id") `);
        await queryRunner.query(`CREATE INDEX "IDX_a7abbfdac3e3d20652b5ee3fcb" ON "follows" ("followingId", "createdAt", "id") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_105079775692df1f8799ed0fac" ON "follows" ("followerId", "followingId") `);
        await queryRunner.query(`CREATE TABLE "users" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "email" character varying, "phone" character varying, "isVerified" boolean NOT NULL DEFAULT false, "fullName" character varying, "username" character varying, "age" integer, "dateOfBirth" date, "gender" smallint, "password" character varying, "provider" "public"."users_provider_enum" NOT NULL DEFAULT 'local', "providerId" character varying, "bio" character varying(150), "profilePicture" character varying, "isPrivate" boolean NOT NULL DEFAULT false, "postsCount" integer NOT NULL DEFAULT '0', "followersCount" integer NOT NULL DEFAULT '0', "followingCount" integer NOT NULL DEFAULT '0', "showSuggestions" boolean NOT NULL DEFAULT true, CONSTRAINT "UQ_97672ac88f789774dd47f7c8be3" UNIQUE ("email"), CONSTRAINT "UQ_a000cca60bcf04454e727699490" UNIQUE ("phone"), CONSTRAINT "UQ_fe0bb3f6520ee0469504521e710" UNIQUE ("username"), CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_fab34e0791096b2a0a1bf8bd7f" ON "users" ("providerId") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_8be20ec8e4944d95229ce915bd" ON "users" ("provider", "providerId") WHERE "providerId" IS NOT NULL`);
        await queryRunner.query(`CREATE INDEX "IDX_47c9769dc90dda57de8f29a5fc" ON "users" ("username", "isVerified") `);
        await queryRunner.query(`CREATE INDEX "IDX_c559222adf737b16d8c94278bf" ON "users" ("phone", "isVerified") `);
        await queryRunner.query(`CREATE INDEX "IDX_136aac53fa22201c0ff93740ab" ON "users" ("email", "isVerified") `);
        await queryRunner.query(`CREATE TABLE "user_sessions" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "user_id" uuid NOT NULL, "sessionId" character varying NOT NULL, "device" character varying, "loginProvider" "public"."user_sessions_loginprovider_enum" NOT NULL DEFAULT 'local', "loginAt" TIMESTAMP NOT NULL, "expiresAt" TIMESTAMP NOT NULL, "isActive" boolean NOT NULL DEFAULT true, CONSTRAINT "UQ_f1d56cb09724333a500af7fe914" UNIQUE ("sessionId"), CONSTRAINT "PK_e93e031a5fed190d4789b6bfd83" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_e9658e959c490b0a634dfc5478" ON "user_sessions" ("user_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_f1d56cb09724333a500af7fe91" ON "user_sessions" ("sessionId") `);
        await queryRunner.query(`CREATE INDEX "IDX_a31e0b412938f358466a7734ce" ON "user_sessions" ("sessionId", "isActive") `);
        await queryRunner.query(`CREATE TABLE "auth_attempts" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "email" character varying, "phone" character varying, "attemptType" "public"."auth_attempts_attempttype_enum" NOT NULL, "status" "public"."auth_attempts_status_enum" NOT NULL, CONSTRAINT "PK_d9115e02f18808834eb82b4a297" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_3915da149ef6fe111c55a772c7" ON "auth_attempts" ("email") `);
        await queryRunner.query(`CREATE INDEX "IDX_2f7ebdba0e82a17e6db7b1fbb2" ON "auth_attempts" ("phone") `);
        await queryRunner.query(`ALTER TABLE "post_tags" ADD CONSTRAINT "FK_4ae64c1a280535113e8b7a66e54" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "post_tags" ADD CONSTRAINT "FK_5df4e8dc2cb3e668b962362265d" FOREIGN KEY ("post_id") REFERENCES "posts"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "posts" ADD CONSTRAINT "FK_c4f9a7bd77b489e711277ee5986" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "saved_posts" ADD CONSTRAINT "FK_78c961371a509e86d789714dd4f" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "saved_posts" ADD CONSTRAINT "FK_116e9df57f5221cc1a77c3d1cfe" FOREIGN KEY ("post_id") REFERENCES "posts"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "follows" ADD CONSTRAINT "FK_ef463dd9a2ce0d673350e36e0fb" FOREIGN KEY ("followingId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "follows" ADD CONSTRAINT "FK_fdb91868b03a2040db408a53331" FOREIGN KEY ("followerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "user_sessions" ADD CONSTRAINT "FK_e9658e959c490b0a634dfc54783" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "user_sessions" DROP CONSTRAINT "FK_e9658e959c490b0a634dfc54783"`);
        await queryRunner.query(`ALTER TABLE "follows" DROP CONSTRAINT "FK_fdb91868b03a2040db408a53331"`);
        await queryRunner.query(`ALTER TABLE "follows" DROP CONSTRAINT "FK_ef463dd9a2ce0d673350e36e0fb"`);
        await queryRunner.query(`ALTER TABLE "saved_posts" DROP CONSTRAINT "FK_116e9df57f5221cc1a77c3d1cfe"`);
        await queryRunner.query(`ALTER TABLE "saved_posts" DROP CONSTRAINT "FK_78c961371a509e86d789714dd4f"`);
        await queryRunner.query(`ALTER TABLE "posts" DROP CONSTRAINT "FK_c4f9a7bd77b489e711277ee5986"`);
        await queryRunner.query(`ALTER TABLE "post_tags" DROP CONSTRAINT "FK_5df4e8dc2cb3e668b962362265d"`);
        await queryRunner.query(`ALTER TABLE "post_tags" DROP CONSTRAINT "FK_4ae64c1a280535113e8b7a66e54"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_2f7ebdba0e82a17e6db7b1fbb2"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_3915da149ef6fe111c55a772c7"`);
        await queryRunner.query(`DROP TABLE "auth_attempts"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_a31e0b412938f358466a7734ce"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_f1d56cb09724333a500af7fe91"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_e9658e959c490b0a634dfc5478"`);
        await queryRunner.query(`DROP TABLE "user_sessions"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_136aac53fa22201c0ff93740ab"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_c559222adf737b16d8c94278bf"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_47c9769dc90dda57de8f29a5fc"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_8be20ec8e4944d95229ce915bd"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_fab34e0791096b2a0a1bf8bd7f"`);
        await queryRunner.query(`DROP TABLE "users"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_105079775692df1f8799ed0fac"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_a7abbfdac3e3d20652b5ee3fcb"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_0b6f3ce73b6bdf8a2e99b6ef83"`);
        await queryRunner.query(`DROP TABLE "follows"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_837a562f71fec3009c9af77ee5"`);
        await queryRunner.query(`DROP TABLE "saved_posts"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_300215aa4b0de9f1d5111678ed"`);
        await queryRunner.query(`DROP TABLE "posts"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_0af861616219606ea6f610b3f8"`);
        await queryRunner.query(`DROP TABLE "post_tags"`);
    }

}
