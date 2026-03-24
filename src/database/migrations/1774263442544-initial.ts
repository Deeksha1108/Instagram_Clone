import { MigrationInterface, QueryRunner } from "typeorm";

export class Initial1774263442544 implements MigrationInterface {
    name = 'Initial1774263442544'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_d5c404ce74b775e290b4514085"`);
        await queryRunner.query(`CREATE TABLE "saved_posts" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "userId" character varying NOT NULL, "postId" character varying NOT NULL, "user_id" uuid, "post_id" uuid, CONSTRAINT "PK_868375ca4f041a2337a1c1a6634" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_4d3790479b4ace0798f7d54c55" ON "saved_posts" ("userId", "postId") `);
        await queryRunner.query(`CREATE TABLE "post_tags" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "userId" character varying NOT NULL, "postId" character varying NOT NULL, "user_id" uuid, "post_id" uuid, CONSTRAINT "PK_0c750579b992a52b24d18ec3431" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_0041a1a05dc7dc46e0b50619a7" ON "post_tags" ("userId", "postId") `);
        await queryRunner.query(`CREATE INDEX "IDX_63b892669b926fe755b7579941" ON "posts" ("userId", "createdAt", "id") `);
        await queryRunner.query(`ALTER TABLE "saved_posts" ADD CONSTRAINT "FK_78c961371a509e86d789714dd4f" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "saved_posts" ADD CONSTRAINT "FK_116e9df57f5221cc1a77c3d1cfe" FOREIGN KEY ("post_id") REFERENCES "posts"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "post_tags" ADD CONSTRAINT "FK_4ae64c1a280535113e8b7a66e54" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "post_tags" ADD CONSTRAINT "FK_5df4e8dc2cb3e668b962362265d" FOREIGN KEY ("post_id") REFERENCES "posts"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "post_tags" DROP CONSTRAINT "FK_5df4e8dc2cb3e668b962362265d"`);
        await queryRunner.query(`ALTER TABLE "post_tags" DROP CONSTRAINT "FK_4ae64c1a280535113e8b7a66e54"`);
        await queryRunner.query(`ALTER TABLE "saved_posts" DROP CONSTRAINT "FK_116e9df57f5221cc1a77c3d1cfe"`);
        await queryRunner.query(`ALTER TABLE "saved_posts" DROP CONSTRAINT "FK_78c961371a509e86d789714dd4f"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_63b892669b926fe755b7579941"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_0041a1a05dc7dc46e0b50619a7"`);
        await queryRunner.query(`DROP TABLE "post_tags"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_4d3790479b4ace0798f7d54c55"`);
        await queryRunner.query(`DROP TABLE "saved_posts"`);
        await queryRunner.query(`CREATE INDEX "IDX_d5c404ce74b775e290b4514085" ON "posts" ("createdAt", "userId") `);
    }

}
