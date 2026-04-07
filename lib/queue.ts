import { DonorData } from './types';
import { globalEventBus } from '../workers/spinWorker';

export const MOCK_QUEUE: DonorData[] = [];

export const spinQueue = {
  add: async (name: string, data: DonorData) => {
    MOCK_QUEUE.push(data);
    // Sắp xếp lại mảng luôn mỗi khi có dữ liệu vào
    MOCK_QUEUE.sort((a, b) => (b.priority || 0) - (a.priority || 0));
    globalEventBus.emit('new_mock_job'); 
    return { id: `job-${Date.now()}` };
  }
};

export const getMockQueue = () => MOCK_QUEUE;
export const shiftMockQueue = () => {
    // Luôn lấy phần tử có ưu tiên cao nhất ở đầu queue (do đã sort lúc add)
    return MOCK_QUEUE.shift();
};
