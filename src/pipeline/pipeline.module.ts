import { Module, Global } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  DocumentContent,
  DocumentContentSchema,
} from '../document/schemas/document-content.schema';
import { PipelineOrchestrator } from './pipeline.orchestrator';
import { ChunkingService } from './chunking.service';
import { EmbeddingService } from './embedding.service';
import { VectorIndexService } from './vector-index.service';

@Global()
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: DocumentContent.name, schema: DocumentContentSchema },
    ]),
  ],
  providers: [
    PipelineOrchestrator,
    ChunkingService,
    EmbeddingService,
    VectorIndexService,
  ],
  exports: [
    PipelineOrchestrator,
    ChunkingService,
    EmbeddingService,
    VectorIndexService,
  ],
})
export class PipelineModule {}
