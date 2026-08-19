import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MongooseModule } from '@nestjs/mongoose';
import { DocumentService } from './document.service';
import { FileParserService } from './services/file-parser.service';
import { DocumentReviewService } from './document-review.service';
import { DocumentController } from './document.controller';
import { DocumentReviewController } from './document-review.controller';
import { DocumentEntity } from './entities/document.entity';
import { DocumentReviewEntity } from './entities/document-review.entity';
import {
  DocumentContent,
  DocumentContentSchema,
} from './schemas/document-content.schema';

@Module({
  imports: [
    TypeOrmModule.forFeature([DocumentEntity, DocumentReviewEntity]),
    MongooseModule.forFeature([
      { name: DocumentContent.name, schema: DocumentContentSchema },
    ]),
  ],
  controllers: [DocumentController, DocumentReviewController],
  providers: [DocumentService, FileParserService, DocumentReviewService],
  exports: [DocumentService, FileParserService, DocumentReviewService],
})
export class DocumentModule {}
