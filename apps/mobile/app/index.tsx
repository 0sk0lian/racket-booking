import React, { useEffect, useMemo, useState } from 'react';
import { SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { CourtBookingCalendar } from '../src/components/CourtBookingCalendar';
import { fetchAvailableSlots, fetchClubs, fetchCourts, type AvailabilitySlot, type Club, type Court } from '../src/api/bookingApi';

function toDateStr(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export default function HomeScreen() {
  const [clubs, setClubs] = useState<Club[]>([]);
  const [courts, setCourts] = useState<Court[]>([]);
  const [selectedClubId, setSelectedClubId] = useState<string | null>(null);
  const [selectedCourtId, setSelectedCourtId] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>(toDateStr(new Date()));
  const [slots, setSlots] = useState<AvailabilitySlot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [status, setStatus] = useState<string>('');

  useEffect(() => {
    fetchClubs()
      .then((response) => {
        const items = response.data ?? [];
        setClubs(items);
        if (items.length > 0) setSelectedClubId(items[0].id);
      })
      .catch(() => setStatus('Could not load clubs.'));
  }, []);

  useEffect(() => {
    if (!selectedClubId) return;

    fetchCourts(selectedClubId)
      .then((response) => {
        const items = response.data ?? [];
        setCourts(items);
        setSelectedCourtId(items[0]?.id ?? null);
      })
      .catch(() => setStatus('Could not load courts.'));
  }, [selectedClubId]);

  useEffect(() => {
    if (!selectedClubId || !selectedCourtId || !selectedDate) return;

    setLoadingSlots(true);
    fetchAvailableSlots(selectedClubId, selectedCourtId, selectedDate)
      .then((response) => {
        const available = response.data?.slots ?? [];
        setSlots(available.sort((a, b) => a.start_hour - b.start_hour));
        setStatus(available.length === 0 ? 'No free slots for this date.' : '');
      })
      .catch(() => {
        setStatus('Could not load availability.');
        setSlots([]);
      })
      .finally(() => setLoadingSlots(false));
  }, [selectedClubId, selectedCourtId, selectedDate]);

  const selectedCourt = useMemo(
    () => courts.find((court) => court.id === selectedCourtId) ?? null,
    [courts, selectedCourtId],
  );

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Racket Booking</Text>
        <Text style={styles.subtitle}>Mobile booking flow preview</Text>

        <Text style={styles.sectionTitle}>1. Choose club</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.row}>
          {clubs.map((club) => (
            <TouchableOpacity
              key={club.id}
              style={[styles.pill, selectedClubId === club.id && styles.pillActive]}
              onPress={() => setSelectedClubId(club.id)}
            >
              <Text style={[styles.pillText, selectedClubId === club.id && styles.pillTextActive]}>{club.name}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <Text style={styles.sectionTitle}>2. Choose court</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.row}>
          {courts.map((court) => (
            <TouchableOpacity
              key={court.id}
              style={[styles.pill, selectedCourtId === court.id && styles.pillActive]}
              onPress={() => setSelectedCourtId(court.id)}
            >
              <Text style={[styles.pillText, selectedCourtId === court.id && styles.pillTextActive]}>
                {court.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {selectedClubId && selectedCourtId && (
          <>
            <Text style={styles.sectionTitle}>3. Pick date</Text>
            <View style={styles.calendarWrapper}>
              <CourtBookingCalendar
                clubId={selectedClubId}
                courtId={selectedCourtId}
                onDayPress={setSelectedDate}
              />
            </View>

            <Text style={styles.sectionTitle}>4. Available times ({selectedDate})</Text>
            {loadingSlots ? (
              <Text style={styles.mutedText}>Loading...</Text>
            ) : (
              <View style={styles.slotsGrid}>
                {slots.map((slot) => (
                  <TouchableOpacity
                    key={`${slot.court_id}-${slot.start_iso}`}
                    style={styles.slotButton}
                    onPress={() => {
                      setStatus(`Selected ${String(slot.start_hour).padStart(2, '0')}:00. Sign-in booking can be enabled next.`);
                    }}
                  >
                    <Text style={styles.slotText}>
                      {String(slot.start_hour).padStart(2, '0')}:00 - {String(slot.end_hour).padStart(2, '0')}:00
                    </Text>
                  </TouchableOpacity>
                ))}
                {slots.length === 0 && <Text style={styles.mutedText}>No slots available.</Text>}
              </View>
            )}
          </>
        )}

        {selectedCourt && (
          <Text style={styles.footnote}>
            Selected: {selectedCourt.name} ({selectedCourt.sport_type}) - {selectedCourt.base_hourly_rate} SEK/h
          </Text>
        )}
        {!!status && <Text style={styles.status}>{status}</Text>}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  content: {
    padding: 20,
    paddingBottom: 40,
    gap: 10,
  },
  title: {
    fontSize: 30,
    fontWeight: '700',
    color: '#0f172a',
  },
  subtitle: {
    fontSize: 14,
    color: '#475569',
    marginBottom: 6,
  },
  sectionTitle: {
    marginTop: 8,
    fontSize: 15,
    fontWeight: '600',
    color: '#0f172a',
  },
  row: {
    flexGrow: 0,
  },
  pill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    backgroundColor: '#ffffff',
    marginRight: 8,
    marginBottom: 4,
  },
  pillActive: {
    borderColor: '#4f46e5',
    backgroundColor: '#eef2ff',
  },
  pillText: {
    color: '#334155',
    fontSize: 13,
    fontWeight: '500',
  },
  pillTextActive: {
    color: '#4338ca',
  },
  calendarWrapper: {
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#ffffff',
  },
  slotsGrid: {
    gap: 8,
  },
  slotButton: {
    borderRadius: 10,
    backgroundColor: '#4f46e5',
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  slotText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  mutedText: {
    color: '#64748b',
    fontSize: 13,
  },
  footnote: {
    marginTop: 10,
    color: '#475569',
    fontSize: 12,
  },
  status: {
    marginTop: 8,
    fontSize: 12,
    color: '#0f172a',
    backgroundColor: '#e2e8f0',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
  },
});
