import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreditLedgerEntry } from '../entities/credit-ledger-entry.entity';
import { LedgerDirection, EntryType, ReferenceKind } from '../enums';
import {
  GetWalletHistoryQueryDto,
  GetWalletHistoryResponseDto,
  CreditLedgerEntryDto,
  LedgerDirectionDto,
  LedgerEntryTypeDto,
} from '@app/contracts/wallet';

@Injectable()
export class WalletLedgerService {
  constructor(
    @InjectRepository(CreditLedgerEntry)
    private readonly ledgerRepo: Repository<CreditLedgerEntry>,
  ) {}

  /**
   * Thêm một bản ghi nhật ký sổ cái (Append-only)
   */
  async recordEntry(data: {
    walletId: string;
    userId: string;
    direction: LedgerDirection;
    entryType: EntryType;
    amount: number;
    balanceAfter: number;
    referenceId?: string;
    referenceKind?: ReferenceKind;
  }): Promise<CreditLedgerEntry> {
    const entry = this.ledgerRepo.create({
      walletId: data.walletId,
      userId: data.userId,
      direction: data.direction,
      entryType: data.entryType,
      amount: data.amount,
      balanceAfter: data.balanceAfter,
      referenceId: data.referenceId,
      referenceKind: data.referenceKind,
    });
    return this.ledgerRepo.save(entry);
  }

  /**
   * Truy vấn lịch sử giao dịch sổ cái kèm bộ lọc và phân trang
   */
  async getHistory(
    userId: string,
    query: GetWalletHistoryQueryDto,
  ): Promise<GetWalletHistoryResponseDto> {
    const page = query.page || 1;
    const limit = query.limit || 50;
    const skip = (page - 1) * limit;

    const qb = this.ledgerRepo
      .createQueryBuilder('entry')
      .where('entry.user_id = :userId', { userId });

    if (query.type) {
      qb.andWhere('entry.direction = :direction', { direction: query.type });
    }

    if (query.entryType) {
      qb.andWhere('entry.entry_type = :entryType', { entryType: query.entryType });
    }

    if (query.from) {
      qb.andWhere('entry.created_at >= :from', { from: new Date(query.from) });
    }

    if (query.to) {
      const toDate = new Date(query.to);
      toDate.setHours(23, 59, 59, 999);
      qb.andWhere('entry.created_at <= :to', { to: toDate });
    }

    qb.orderBy('entry.created_at', 'DESC');
    qb.skip(skip).take(limit);

    const [entries, total] = await qb.getManyAndCount();

    const formattedEntries: CreditLedgerEntryDto[] = entries.map((e) => ({
      id: e.id,
      direction: e.direction as unknown as LedgerDirectionDto,
      entryType: e.entryType as unknown as LedgerEntryTypeDto,
      amount: e.amount,
      balanceAfter: e.balanceAfter,
      referenceId: e.referenceId,
      referenceKind: e.referenceKind,
      createdAt: e.createdAt,
    }));

    return {
      entries: formattedEntries,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  /**
   * Thống kê tài chính toàn hệ thống dành cho Admin
   */
  async getSystemFinancialStats() {
    // 1. Tổng tiền giải ngân hoàn tất
    const releaseRes = await this.ledgerRepo
      .createQueryBuilder('e')
      .select('SUM(e.amount)', 'total')
      .where('e.entry_type = :type', { type: EntryType.ESCROW_RELEASE })
      .getRawOne();
    const totalCompletedTransfers = Number(releaseRes?.total) || 0;

    // 2. Tổng tiền hoàn trả
    const refundRes = await this.ledgerRepo
      .createQueryBuilder('e')
      .select('SUM(e.amount)', 'total')
      .where('e.entry_type = :type', { type: EntryType.CANCELLATION_REFUND })
      .getRawOne();
    const totalRefunded = Number(refundRes?.total) || 0;

    // 3. Tổng số lượng credit giao dịch
    const circRes = await this.ledgerRepo
      .createQueryBuilder('e')
      .select('SUM(e.amount)', 'total')
      .getRawOne();
    const systemCirculation = Number(circRes?.total) || 0;

    // 4. Tổng credit đang bị ký quỹ
    const holdRes = await this.ledgerRepo
      .createQueryBuilder('e')
      .select('SUM(e.amount)', 'total')
      .where('e.entry_type = :type', { type: EntryType.ESCROW_HOLD })
      .getRawOne();
    const totalEscrowHeld = Math.max(0, (Number(holdRes?.total) || 0) - totalCompletedTransfers - totalRefunded);

    return {
      totalEscrowHeld,
      totalCompletedTransfers,
      totalRefunded,
      systemCirculation: systemCirculation > 0 ? systemCirculation : totalCompletedTransfers + totalEscrowHeld,
    };
  }

  /**
   * Lấy toàn bộ nhật ký sổ cái toàn hệ thống cho Admin
   */
  async getAllLedgerEntries(page = 1, limit = 50) {
    const skip = (page - 1) * limit;

    const [entries, total] = await this.ledgerRepo.findAndCount({
      order: { createdAt: 'DESC' },
      skip,
      take: limit,
    });

    const formattedEntries = entries.map((e) => ({
      id: e.id,
      userId: e.userId,
      walletId: e.walletId,
      direction: e.direction,
      entryType: e.entryType,
      amount: e.amount,
      balanceAfter: e.balanceAfter,
      referenceId: e.referenceId,
      referenceKind: e.referenceKind,
      createdAt: e.createdAt,
    }));

    return {
      entries: formattedEntries,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }
}
