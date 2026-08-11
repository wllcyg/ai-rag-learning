import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type DocumentContentDocument = HydratedDocument<DocumentContent>;

@Schema({ collection: 'document_content', timestamps: true })
export class DocumentContent {
  @Prop({ required: true, unique: true, index: true })
  documentId: string;

  @Prop({ required: true })
  content: string;

  @Prop({ default: 0 })
  contentLength: number;

  @Prop()
  contentSummary: string;

  @Prop({ default: 1 })
  version: number;

  @Prop({ default: false, index: true })
  deleted: boolean;
}

export const DocumentContentSchema =
  SchemaFactory.createForClass(DocumentContent);
