import { Module, Global } from '@nestjs/common';
import { RabbitMqService } from './rabbitmq.service';
import { DocumentPipelinePublisher } from './document-pipeline.publisher';
import { DocumentPipelineConsumer } from './document-pipeline.consumer';
import { PipelineModule } from '../pipeline/pipeline.module';

@Global()
@Module({
  imports: [PipelineModule],
  providers: [
    RabbitMqService,
    DocumentPipelinePublisher,
    DocumentPipelineConsumer,
  ],
  exports: [RabbitMqService, DocumentPipelinePublisher],
})
export class MqModule {}
