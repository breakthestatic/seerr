import type { MigrationInterface, QueryRunner } from 'typeorm';

export class RevertAltTo4kNaming1768492778648 implements MigrationInterface {
  name = 'RevertAltTo4kNaming1768492778648';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "media_request" RENAME COLUMN "isAlt" TO "is4k"`
    );
    await queryRunner.query(
      `ALTER TABLE "media" RENAME COLUMN "statusAlt" TO "status4k"`
    );
    await queryRunner.query(
      `ALTER TABLE "media" RENAME COLUMN "serviceIdAlt" TO "serviceId4k"`
    );
    await queryRunner.query(
      `ALTER TABLE "media" RENAME COLUMN "externalServiceIdAlt" TO "externalServiceId4k"`
    );
    await queryRunner.query(
      `ALTER TABLE "media" RENAME COLUMN "externalServiceSlugAlt" TO "externalServiceSlug4k"`
    );
    await queryRunner.query(
      `ALTER TABLE "media" RENAME COLUMN "ratingKeyAlt" TO "ratingKey4k"`
    );
    await queryRunner.query(
      `ALTER TABLE "media" RENAME COLUMN "jellyfinMediaIdAlt" TO "jellyfinMediaId4k"`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "media_request" RENAME COLUMN "is4k" TO "isAlt"`
    );
    await queryRunner.query(
      `ALTER TABLE "media" RENAME COLUMN "status4k" TO "statusAlt"`
    );
    await queryRunner.query(
      `ALTER TABLE "media" RENAME COLUMN "serviceId4k" TO "serviceIdAlt"`
    );
    await queryRunner.query(
      `ALTER TABLE "media" RENAME COLUMN "externalServiceId4k" TO "externalServiceIdAlt"`
    );
    await queryRunner.query(
      `ALTER TABLE "media" RENAME COLUMN "externalServiceSlug4k" TO "externalServiceSlugAlt"`
    );
    await queryRunner.query(
      `ALTER TABLE "media" RENAME COLUMN "ratingKey4k" TO "ratingKeyAlt"`
    );
    await queryRunner.query(
      `ALTER TABLE "media" RENAME COLUMN "jellyfinMediaId4k" TO "jellyfinMediaIdAlt"`
    );
  }
}
