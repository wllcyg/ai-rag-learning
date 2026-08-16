import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MongooseModule } from '@nestjs/mongoose';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DocumentModule } from './document/document.module';
import { DocumentEntity } from './document/entities/document.entity';
import { StorageModule } from './storage/storage.module';
import { MqModule } from './mq/mq.module';

@Module({
  imports: [
    // 🌟 NestJS 原生 ConfigModule（全局可用）
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get<string>('POSTGRES_HOST') ?? 'localhost',
        port: Number(configService.get<number>('POSTGRES_PORT') ?? 5432),
        username: configService.get<string>('POSTGRES_USER') ?? 'user',
        password: configService.get<string>('POSTGRES_PASSWORD') ?? '123456',
        database: configService.get<string>('POSTGRES_DB') ?? 'knowledge_hub',
        entities: [DocumentEntity],
        synchronize: false,
      }),
    }),
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        uri:
          configService.get<string>('MONGODB_URI') ??
          'mongodb://mongo_user:mongo_pass123@localhost:27017/knowledge_hub?authSource=admin',
      }),
    }),
    StorageModule,
    DocumentModule,
    MqModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
