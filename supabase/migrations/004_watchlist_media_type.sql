-- Add media_type to watchlist so TV shows are stored correctly
alter table watchlist
  add column if not exists media_type varchar(10) default 'movie' check (media_type in ('movie', 'tv'));
