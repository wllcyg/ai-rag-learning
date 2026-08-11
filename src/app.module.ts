import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MongooseModule } from '@nestjs/mongoose';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DocumentModule } from './document/document.module';
import { DocumentEntity } from './document/entities/document.entity';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.POSTGRES_HOST ?? 'localhost',
      port: Number(process.env.POSTGRES_PORT ?? 5432),
      username: process.env.POSTGRES_USER ?? 'user',
      password: process.env.POSTGRES_PASSWORD ?? '123456',
      database: process.env.POSTGRES_DB ?? 'knowledge_hub',
      entities: [DocumentEntity],
      synchronize: false, // 已有数据库表，不使用 synchronize
    }),
    MongooseModule.forRoot(
      process.env.MONGODB_URI ??
        'mongodb://mongo_user:mongo_pass123@localhost:27017/knowledge_hub?authSource=admin',
    ),
    DocumentModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
