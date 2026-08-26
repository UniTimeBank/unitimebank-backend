import { Injectable, HttpException, HttpStatus } from '@nestjs/common';

@Injectable()
export class BookingClient {
  private readonly BOOKING_SERVICE_URL = process.env.BOOKING_SERVICE_URL || 'http://localhost:3004';

  private async request(method: string, path: string, data?: any, headers?: Record<string, string>) {
    const url = `${this.BOOKING_SERVICE_URL}${path}`;
    const isFormData = typeof FormData !== 'undefined' && data instanceof FormData;

    const requestHeaders: Record<string, string> = { ...headers };
    if (!isFormData) {
      requestHeaders['Content-Type'] = 'application/json';
    }

    const options: RequestInit = {
      method,
      headers: requestHeaders,
    };

    if (data) {
      options.body = isFormData ? data : JSON.stringify(data);
    }

    try {
      const response = await fetch(url, options);
      const result = await response.json();
      if (!response.ok) {
        throw new HttpException(
          result.message || result.error || 'Lỗi xử lý hệ thống đặt lịch',
          response.status || HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }
      return result;
    } catch (err) {
      if (err instanceof HttpException) {
        throw err;
      }
      throw new HttpException(
        'Không thể kết nối đến Dịch vụ Đặt lịch (Booking Service)',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }

  async createBooking(data: any, headers: Record<string, string>) {
    return this.request('POST', '/bookings', data, headers);
  }

  async applyLearnerRequest(data: any, headers: Record<string, string>) {
    return this.request('POST', '/bookings/apply-learner-request', data, headers);
  }

  async acceptBooking(bookingId: string, headers: Record<string, string>) {
    return this.request('POST', `/bookings/${bookingId}/accept`, undefined, headers);
  }

  async completeBooking(bookingId: string, headers: Record<string, string>) {
    return this.request('POST', `/bookings/${bookingId}/complete`, undefined, headers);
  }

  async rejectBooking(bookingId: string, data: any, headers: Record<string, string>) {
    return this.request('POST', `/bookings/${bookingId}/reject`, data, headers);
  }

  async cancelBooking(bookingId: string, data: any, headers: Record<string, string>) {
    return this.request('POST', `/bookings/${bookingId}/cancel`, data, headers);
  }

  async markNoShow(bookingId: string, headers: Record<string, string>) {
    return this.request('POST', `/bookings/${bookingId}/no-show`, undefined, headers);
  }

  async getMyBookings(queryString: string, headers: Record<string, string>) {
    const path = queryString ? `/bookings?${queryString}` : '/bookings';
    return this.request('GET', path, undefined, headers);
  }

  async getMentorBusySlots(mentorId: string, from?: string, to?: string, headers?: Record<string, string>) {
    const params = new URLSearchParams();
    if (from) params.append('from', from);
    if (to) params.append('to', to);
    const qs = params.toString();
    const path = `/bookings/mentor/${mentorId}/busy-slots${qs ? `?${qs}` : ''}`;
    return this.request('GET', path, undefined, headers);
  }

  async getBookingById(bookingId: string, headers: Record<string, string>) {
    return this.request('GET', `/bookings/${bookingId}`, undefined, headers);
  }

  async getBookingMessages(bookingId: string, headers: Record<string, string>) {
    return this.request('GET', `/bookings/${bookingId}/messages`, undefined, headers);
  }

  async sendBookingMessage(bookingId: string, data: any, headers: Record<string, string>) {
    return this.request('POST', `/bookings/${bookingId}/messages`, data, headers);
  }

  async setTypingStatus(bookingId: string, typing: boolean, headers: Record<string, string>) {
    return this.request('POST', `/bookings/${bookingId}/typing`, { typing }, headers);
  }

}


