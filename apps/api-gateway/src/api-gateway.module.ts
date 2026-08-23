import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { AuthClient } from './clients/auth.client';
import { UserClient } from './clients/user.client';
import { PostClient } from './clients/post.client';
import { BookingClient } from './clients/booking.client';
import { SessionClient } from './clients/session.client';
import { WalletClient } from './clients/wallet.client';
import { ModerationClient } from './clients/moderation.client';
import { NotificationClient } from './clients/notification.client';
import { NotificationGateway } from './gateways/notification.gateway';
import { SessionGateway } from './gateways/session.gateway';
import { AuthRoutes } from './routes/auth.routes';
import { UserRoutes, UserAvatarRoutes, UserFollowRoutes, UserCheckinRoutes, UserSkillRoutes, SkillCategoryRoutes, UserScheduleRoutes } from './routes/user.routes';
import { PostMentorRoutes, PostLearnerRoutes, PostSearchRoutes } from './routes/post.routes';
import { BookingRoutes } from './routes/booking.routes';
import { SessionRoutes } from './routes/session.routes';
import { WalletRoutes } from './routes/wallet.routes';
import { ModerationRoutes } from './routes/moderation.routes';
import { NotificationRoutes } from './routes/notification.routes';

import { CommonModule } from '@app/common';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    CommonModule,
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 100,
      },
    ]),
  ],
  controllers: [
    AuthRoutes,
    UserRoutes,
    UserAvatarRoutes,
    UserFollowRoutes,
    UserCheckinRoutes,
    UserSkillRoutes,
    SkillCategoryRoutes,
    UserScheduleRoutes,
    PostMentorRoutes,
    PostLearnerRoutes,
    PostSearchRoutes,
    BookingRoutes,
    SessionRoutes,
    WalletRoutes,
    ModerationRoutes,
    NotificationRoutes,
  ],
  providers: [
    AuthClient,
    UserClient,
    PostClient,
    BookingClient,
    SessionClient,
    WalletClient,
    ModerationClient,
    NotificationClient,
    NotificationGateway,
    SessionGateway,
  ],
})
export class ApiGatewayModule {}


