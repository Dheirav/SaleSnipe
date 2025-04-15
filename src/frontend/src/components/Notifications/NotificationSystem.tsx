import React, { useEffect, useState } from 'react';
import apiService from '../../services/api';
import { Notification } from '../../types';
import toast from 'react-hot-toast';

const NotificationSystem: React.FC = () => {
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [isOpen, setIsOpen] = useState<boolean>(false);
    const [newCount, setNewCount] = useState<number>(0);

    useEffect(() => {
        fetchNotifications();
        
        // Poll for new notifications every minute
        const interval = setInterval(fetchNotifications, 60000);
        return () => clearInterval(interval);
    }, []);

    const fetchNotifications = async () => {
        try {
            const response = await apiService.notifications.getAll();
            if (response.data && response.data.notifications) {
                const newNotifications = response.data.notifications;
                setNotifications(newNotifications);
                // Count unread notifications
                const unreadCount = newNotifications.filter((n: Notification) => !n.read).length;
                if (unreadCount > 0 && newCount < unreadCount) {
                    // Only show toast for genuinely new notifications
                    if (newCount > 0) {
                        toast.success(`You have ${unreadCount - newCount} new price alerts!`);
                    }
                    setNewCount(unreadCount);
                }
            }
        } catch (error) {
            console.error('Error fetching notifications:', error);
        }
    };

    const handleDismiss = async (notificationId: string) => {
        try {
            await apiService.notifications.markAsRead(notificationId);
            setNotifications(notifications.map((n: Notification) => 
                n._id === notificationId ? { ...n, read: true } : n
            ));
            setNewCount(prev => Math.max(0, prev - 1));
        } catch (error) {
            console.error('Error dismissing notification:', error);
        }
    };

    const handleMarkAllAsRead = async () => {
        try {
            await apiService.notifications.markAllAsRead();
            setNotifications(notifications.map((n: Notification) => ({ ...n, read: true })));
            setNewCount(0);
        } catch (error) {
            console.error('Error marking all as read:', error);
        }
    };

    const getNotificationMessage = (notification: Notification) => {
        switch (notification.type) {
            case 'price_drop':
                return `Price drop alert: ${notification.product.title} is now ${notification.product.currentPrice} (${notification.data.percentageChange}% drop)`;
            case 'price_increase':
                return `Price increase: ${notification.product.title} has increased by ${notification.data.percentageChange}%`;
            case 'back_in_stock':
                return `${notification.product.title} is back in stock!`;
            case 'lowest_price':
                return `${notification.product.title} is at its lowest price ever!`;
            default:
                return `Alert for ${notification.product.title}`;
        }
    };

    return (
        <>
            {/* Notification Bell */}
            <div className="relative">
                <button 
                    onClick={() => setIsOpen(!isOpen)}
                    className="p-2 rounded-full hover:bg-gray-200 focus:outline-none"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                    </svg>
                    {newCount > 0 && (
                        <span className="absolute top-0 right-0 bg-red-500 text-white rounded-full text-xs w-5 h-5 flex items-center justify-center">
                            {newCount}
                        </span>
                    )}
                </button>
            </div>

            {/* Notification Panel */}
            {isOpen && (
                <div className="fixed top-16 right-4 w-80 bg-white rounded-lg shadow-xl overflow-hidden z-50">
                    <div className="p-4 border-b flex justify-between items-center">
                        <h2 className="font-bold text-lg">Notifications</h2>
                        {notifications.some(n => !n.read) && (
                            <button 
                                onClick={handleMarkAllAsRead}
                                className="text-sm text-blue-600 hover:text-blue-800"
                            >
                                Mark all as read
                            </button>
                        )}
                    </div>
                    
                    <div className="max-h-96 overflow-y-auto">
                        {notifications.length === 0 ? (
                            <div className="p-4 text-center text-gray-500">
                                No notifications
                            </div>
                        ) : (
                            <ul>
                                {notifications.map((notification) => (
                                    <li 
                                        key={notification._id} 
                                        className={`p-4 border-b hover:bg-gray-50 ${!notification.read ? 'bg-blue-50' : ''}`}
                                    >
                                        <div className="flex justify-between">
                                            <div>
                                                <p className={!notification.read ? 'font-medium' : ''}>
                                                    {getNotificationMessage(notification)}
                                                </p>
                                                <p className="text-xs text-gray-500 mt-1">
                                                    {new Date(notification.createdAt).toLocaleString()}
                                                </p>
                                            </div>
                                            {!notification.read && (
                                                <button
                                                    onClick={() => handleDismiss(notification._id)}
                                                    className="text-gray-400 hover:text-gray-600"
                                                >
                                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                                        <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                                                    </svg>
                                                </button>
                                            )}
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                </div>
            )}
        </>
    );
};

export default NotificationSystem;