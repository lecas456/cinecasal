-- Allow authenticated users to delete their own watchlist entries
create policy "Authenticated users can delete from watchlist"
  on watchlist for delete
  to authenticated
  using (true);
