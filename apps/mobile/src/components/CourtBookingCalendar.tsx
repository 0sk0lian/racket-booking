import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { Calendar, DateData } from 'react-native-calendars';
import { fetchAvailableSlots } from '../api/bookingApi';

interface Props {
  courtId: string;
  onDayPress: (dateString: string) => void;
}

/**
 * Calendar component showing court availability.
 * Fully booked days are disabled; available days show a green dot.
 *
 * Reference: docs/ARCHITECTURE.md → "Frontend Architecture: Mobile Player Application"
 */
export const CourtBookingCalendar: React.FC<Props> = ({ courtId, onDayPress }) => {
  const [markedDates, setMarkedDates] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadAvailability = async () => {
      try {
        // Load next 30 days of availability
        const today = new Date();
        const formattedDates: Record<string, any> = {};

        for (let i = 0; i < 30; i++) {
          const date = new Date(today);
          date.setDate(date.getDate() + i);
          const dateString = date.toISOString().split('T')[0];

          const result = await fetchAvailableSlots(courtId, dateString);
          const slots = result.data || [];

          // Simple heuristic: if 10+ hours are booked, mark as fully booked
          if (slots.length >= 10) {
            formattedDates[dateString] = {
              disabled: true,
              disableTouchEvent: true,
              dotColor: '#e0e0e0',
              marked: true,
            };
          } else {
            formattedDates[dateString] = {
              marked: true,
              dotColor: '#50cebb',
            };
          }
        }

        setMarkedDates(formattedDates);
      } catch (err) {
        console.error('Failed to load availability:', err);
      } finally {
        setLoading(false);
      }
    };

    loadAvailability();
  }, [courtId]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#00adf5" />
        <Text style={styles.loadingText}>Loading availability...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Calendar
        minDate={new Date().toISOString().split('T')[0]}
        markedDates={markedDates}
        onDayPress={(day: DateData) => {
          onDayPress(day.dateString);
        }}
        theme={{
          todayTextColor: '#00adf5',
          selectedDayBackgroundColor: '#00adf5',
          arrowColor: '#00adf5',
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
    paddingTop: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
  },
});
