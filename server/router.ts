import { router, protectedProcedure, publicProcedure } from './trpc';
import { z } from 'zod';
import { db, mockMovies, isDatabaseConnected, mockRecommendations, mockAbsoluteCinema, saveMockMovies, saveMockRecommendations, saveMockAbsoluteCinema } from './db';
import type { MockMovie, MockRecommendation, MockAbsoluteCinema } from './db';
import * as schema from './schema';
import { eq, and } from 'drizzle-orm';
import { deleteFromS3 } from './s3';

const movieInputSchema = z.object({
  title: z.string().min(1, 'Title is required').max(255),
  thumbnailUrl: z.string().min(1, 'Thumbnail URL is required'),
  thumbnailKey: z.string().nullable(),
  aspectRatio: z.enum(['16:9', '9:16']),
  collection: z.enum(['watched', 'watchLater']),
  recommendedBy: z.string().nullable().optional(),
});

const movieEditSchema = z.object({
  id: z.string(),
  title: z.string().min(1, 'Title is required').max(255),
  thumbnailUrl: z.string().min(1).optional(),
  thumbnailKey: z.string().nullable().optional(),
  aspectRatio: z.enum(['16:9', '9:16']).optional(),
  collection: z.enum(['watched', 'watchLater']).optional(),
  recommendedBy: z.string().nullable().optional(),
});

const recommendationInputSchema = z.object({
  title: z.string().min(1, 'Title is required').max(255),
  thumbnailUrl: z.string().min(1, 'Thumbnail URL is required'),
  thumbnailKey: z.string().nullable().optional(),
  rank: z.number().int().min(1),
  recommendedBy: z.string().min(1, 'Name is required').max(100),
});

const recommendationEditSchema = z.object({
  id: z.string(),
  title: z.string().min(1, 'Title is required').max(255).optional(),
  thumbnailUrl: z.string().min(1).optional(),
  thumbnailKey: z.string().nullable().optional(),
  rank: z.number().int().min(1).optional(),
  recommendedBy: z.string().min(1).max(100).optional(),
});

const absoluteCinemaInputSchema = z.object({
  title: z.string().min(1, 'Title is required').max(255),
  thumbnailUrl: z.string().min(1, 'Thumbnail URL is required'),
  thumbnailKey: z.string().nullable().optional(),
  rank: z.number().int().min(1),
});

const absoluteCinemaEditSchema = z.object({
  id: z.string(),
  title: z.string().min(1, 'Title is required').max(255).optional(),
  thumbnailUrl: z.string().min(1).optional(),
  thumbnailKey: z.string().nullable().optional(),
  rank: z.number().int().min(1).optional(),
});

export const appRouter = router({
  // Get all movies for the logged-in user
  getMovies: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.user.id;
    
    if (isDatabaseConnected && db) {
      try {
        console.log(`tRPC: Fetching movies from database for user ${userId}...`);
        const results = await db.select().from(schema.movies).where(eq(schema.movies.userId, userId));
        return results;
      } catch (err) {
        console.error('Database query error in getMovies, falling back to mock:', err);
      }
    }
    
    // In-memory fallback
    console.log(`tRPC: Fetching mock movies for user ${userId}...`);
    return mockMovies.filter((movie) => movie.userId === userId);
  }),

  // Add a new movie
  addMovie: protectedProcedure
    .input(movieInputSchema)
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.user.id;
      const movieId = Math.random().toString(36).substring(2, 11);
      
      const newMovie = {
        id: movieId,
        userId,
        title: input.title,
        thumbnailUrl: input.thumbnailUrl,
        thumbnailKey: input.thumbnailKey,
        aspectRatio: input.aspectRatio,
        collection: input.collection,
        recommendedBy: input.recommendedBy || null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      if (isDatabaseConnected && db) {
        try {
          console.log('tRPC: Inserting new movie into database:', input.title);
          await db.insert(schema.movies).values({
            id: newMovie.id,
            userId: newMovie.userId,
            title: newMovie.title,
            thumbnailUrl: newMovie.thumbnailUrl,
            thumbnailKey: newMovie.thumbnailKey || null,
            aspectRatio: newMovie.aspectRatio,
            collection: newMovie.collection,
            recommendedBy: newMovie.recommendedBy,
          });
          return { success: true, movie: newMovie };
        } catch (err) {
          console.error('Database query error in addMovie, falling back to mock:', err);
        }
      }

      // In-memory fallback
      console.log('tRPC: Saving movie in-memory:', input.title);
      mockMovies.unshift(newMovie as MockMovie);
      saveMockMovies(mockMovies);
      return { success: true, movie: newMovie };
    }),

  // Edit a movie's details
  editMovie: protectedProcedure
    .input(movieEditSchema)
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.user.id;
      
      if (isDatabaseConnected && db) {
        try {
          console.log(`tRPC: Updating movie ${input.id} in database...`);
          const updateData: Partial<typeof schema.movies.$inferInsert> = {
            title: input.title,
            updatedAt: new Date(),
          };
          if (input.thumbnailUrl) updateData.thumbnailUrl = input.thumbnailUrl;
          if (input.thumbnailKey !== undefined) updateData.thumbnailKey = input.thumbnailKey;
          if (input.aspectRatio) updateData.aspectRatio = input.aspectRatio;
          if (input.collection) updateData.collection = input.collection;
          if (input.recommendedBy !== undefined) updateData.recommendedBy = input.recommendedBy;

          await db.update(schema.movies)
            .set(updateData)
            .where(and(eq(schema.movies.id, input.id), eq(schema.movies.userId, userId)));
            
          return { success: true };
        } catch (err) {
          console.error('Database error in editMovie, falling back to mock:', err);
        }
      }

      // In-memory fallback
      console.log(`tRPC: Updating mock movie ${input.id}...`);
      const movieIdx = mockMovies.findIndex((m) => m.id === input.id && m.userId === userId);
      if (movieIdx === -1) {
        throw new Error('Movie not found');
      }

      const existing = mockMovies[movieIdx];
      // If we are replacing the thumbnail, let's delete the old thumbnail
      if (input.thumbnailKey && existing.thumbnailKey && existing.thumbnailKey !== input.thumbnailKey) {
        await deleteFromS3(existing.thumbnailKey);
      }

      mockMovies[movieIdx] = {
        ...existing,
        title: input.title,
        thumbnailUrl: input.thumbnailUrl ?? existing.thumbnailUrl,
        thumbnailKey: input.thumbnailKey !== undefined ? input.thumbnailKey : existing.thumbnailKey,
        aspectRatio: input.aspectRatio ?? existing.aspectRatio,
        collection: input.collection ?? existing.collection,
        recommendedBy: input.recommendedBy !== undefined ? input.recommendedBy : existing.recommendedBy,
        updatedAt: new Date(),
      };
      saveMockMovies(mockMovies);

      return { success: true, movie: mockMovies[movieIdx] };
    }),

  // Delete a movie
  deleteMovie: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.user.id;
      let thumbnailKey: string | null = null;

      // Find the thumbnail key first to clean up storage
      if (isDatabaseConnected && db) {
        try {
          const results = await db.select({ key: schema.movies.thumbnailKey })
            .from(schema.movies)
            .where(and(eq(schema.movies.id, input.id), eq(schema.movies.userId, userId)))
            .limit(1);
          if (results.length > 0) {
            thumbnailKey = results[0].key;
          }
        } catch (err) {
          console.error('Error fetching movie key in deleteMovie:', err);
        }
      } else {
        const movie = mockMovies.find((m) => m.id === input.id && m.userId === userId);
        if (movie) {
          thumbnailKey = movie.thumbnailKey;
        }
      }

      // Delete the file from S3 / Local storage
      if (thumbnailKey) {
        await deleteFromS3(thumbnailKey);
      }

      // Delete the record from the database
      if (isDatabaseConnected && db) {
        try {
          console.log(`tRPC: Deleting movie ${input.id} from database...`);
          await db.delete(schema.movies)
            .where(and(eq(schema.movies.id, input.id), eq(schema.movies.userId, userId)));
          return { success: true };
        } catch (err) {
          console.error('Database query error in deleteMovie, falling back to mock:', err);
        }
      }

      // In-memory fallback
      console.log(`tRPC: Deleting mock movie ${input.id}...`);
      const movieIdx = mockMovies.findIndex((m) => m.id === input.id && m.userId === userId);
      if (movieIdx !== -1) {
        mockMovies.splice(movieIdx, 1);
        saveMockMovies(mockMovies);
      }
      return { success: true };
    }),

  // Move movie between collection states
  moveCollection: protectedProcedure
    .input(z.object({
      id: z.string(),
      collection: z.enum(['watched', 'watchLater']),
    }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.user.id;

      if (isDatabaseConnected && db) {
        try {
          console.log(`tRPC: Moving movie ${input.id} to ${input.collection} in database...`);
          await db.update(schema.movies)
            .set({ collection: input.collection, updatedAt: new Date() })
            .where(and(eq(schema.movies.id, input.id), eq(schema.movies.userId, userId)));
          return { success: true };
        } catch (err) {
          console.error('Database error in moveCollection, falling back to mock:', err);
        }
      }

      // In-memory fallback
      console.log(`tRPC: Moving mock movie ${input.id} to ${input.collection}...`);
      const movie = mockMovies.find((m) => m.id === input.id && m.userId === userId);
      if (!movie) {
        throw new Error('Movie not found');
      }
      movie.collection = input.collection;
      movie.updatedAt = new Date();
      saveMockMovies(mockMovies);
      return { success: true, movie };
    }),

  // Edit movie title inline (blur to save)
  editTitle: protectedProcedure
    .input(z.object({
      id: z.string(),
      title: z.string().min(1, 'Title is required').max(255),
    }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.user.id;

      if (isDatabaseConnected && db) {
        try {
          console.log(`tRPC: Updating title inline for ${input.id} in database...`);
          await db.update(schema.movies)
            .set({ title: input.title, updatedAt: new Date() })
            .where(and(eq(schema.movies.id, input.id), eq(schema.movies.userId, userId)));
          return { success: true };
        } catch (err) {
          console.error('Database error in editTitle, falling back to mock:', err);
        }
      }

      // In-memory fallback
      console.log(`tRPC: Updating title inline for mock movie ${input.id}...`);
      const movie = mockMovies.find((m) => m.id === input.id && m.userId === userId);
      if (!movie) {
        throw new Error('Movie not found');
      }
      movie.title = input.title;
      movie.updatedAt = new Date();
      saveMockMovies(mockMovies);
      return { success: true, movie };
    }),

  // ==========================================
  // ABSOLUTE CINEMA SECTION ENDPOINTS
  // ==========================================

  getAbsoluteCinema: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.user.id;
    
    if (isDatabaseConnected && db) {
      try {
        console.log(`tRPC: Fetching Absolute Cinema rankings for user ${userId}...`);
        const results = await db.select().from(schema.absoluteCinema).where(eq(schema.absoluteCinema.userId, userId)).orderBy(schema.absoluteCinema.rank);
        return results;
      } catch (err) {
        console.error('Database query error in getAbsoluteCinema, falling back to mock:', err);
      }
    }
    
    // In-memory fallback
    console.log(`tRPC: Fetching mock Absolute Cinema for user ${userId}...`);
    return mockAbsoluteCinema.filter((rec) => rec.userId === userId).sort((a, b) => a.rank - b.rank);
  }),

  addAbsoluteCinema: protectedProcedure
    .input(absoluteCinemaInputSchema)
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.user.id;
      const recId = Math.random().toString(36).substring(2, 11);
      
      const newRec = {
        id: recId,
        userId,
        title: input.title,
        thumbnailUrl: input.thumbnailUrl,
        thumbnailKey: input.thumbnailKey || null,
        rank: input.rank,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      if (isDatabaseConnected && db) {
        try {
          console.log('tRPC: Inserting new Absolute Cinema movie into database:', input.title);
          await db.insert(schema.absoluteCinema).values({
            id: newRec.id,
            userId: newRec.userId,
            title: newRec.title,
            thumbnailUrl: newRec.thumbnailUrl,
            thumbnailKey: newRec.thumbnailKey,
            rank: newRec.rank,
          });
          return { success: true, movie: newRec };
        } catch (err) {
          console.error('Database error in addAbsoluteCinema, falling back to mock:', err);
        }
      }

      // In-memory fallback
      console.log('tRPC: Saving Absolute Cinema in-memory:', input.title);
      mockAbsoluteCinema.push(newRec as MockAbsoluteCinema);
      saveMockAbsoluteCinema(mockAbsoluteCinema);
      return { success: true, movie: newRec };
    }),

  editAbsoluteCinema: protectedProcedure
    .input(absoluteCinemaEditSchema)
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.user.id;
      
      if (isDatabaseConnected && db) {
        try {
          console.log(`tRPC: Updating Absolute Cinema movie ${input.id} in database...`);
          const updateData: Partial<typeof schema.absoluteCinema.$inferInsert> = {
            updatedAt: new Date(),
          };
          if (input.title) updateData.title = input.title;
          if (input.rank !== undefined) updateData.rank = input.rank;
          if (input.thumbnailUrl) updateData.thumbnailUrl = input.thumbnailUrl;
          if (input.thumbnailKey !== undefined) updateData.thumbnailKey = input.thumbnailKey;

          await db.update(schema.absoluteCinema)
            .set(updateData)
            .where(and(eq(schema.absoluteCinema.id, input.id), eq(schema.absoluteCinema.userId, userId)));
            
          return { success: true };
        } catch (err) {
          console.error('Database error in editAbsoluteCinema, falling back to mock:', err);
        }
      }

      // In-memory fallback
      console.log(`tRPC: Updating mock Absolute Cinema ${input.id}...`);
      const recIdx = mockAbsoluteCinema.findIndex((r) => r.id === input.id && r.userId === userId);
      if (recIdx === -1) {
        throw new Error('Ranking not found');
      }

      const existing = mockAbsoluteCinema[recIdx];
      // Clean up old thumbnail
      if (input.thumbnailKey && existing.thumbnailKey && existing.thumbnailKey !== input.thumbnailKey) {
        await deleteFromS3(existing.thumbnailKey);
      }

      mockAbsoluteCinema[recIdx] = {
        ...existing,
        title: input.title ?? existing.title,
        rank: input.rank ?? existing.rank,
        thumbnailUrl: input.thumbnailUrl ?? existing.thumbnailUrl,
        thumbnailKey: input.thumbnailKey !== undefined ? input.thumbnailKey : existing.thumbnailKey,
        updatedAt: new Date(),
      };
      saveMockAbsoluteCinema(mockAbsoluteCinema);

      return { success: true, movie: mockAbsoluteCinema[recIdx] };
    }),

  deleteAbsoluteCinema: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.user.id;
      let thumbnailKey: string | null = null;
      
      if (isDatabaseConnected && db) {
        try {
          const results = await db.select({ key: schema.absoluteCinema.thumbnailKey })
            .from(schema.absoluteCinema)
            .where(and(eq(schema.absoluteCinema.id, input.id), eq(schema.absoluteCinema.userId, userId)))
            .limit(1);
          if (results.length > 0) {
            thumbnailKey = results[0].key;
          }
        } catch (err) {
          console.error('Error fetching key in deleteAbsoluteCinema:', err);
        }
      } else {
        const rec = mockAbsoluteCinema.find((r) => r.id === input.id && r.userId === userId);
        if (rec) {
          thumbnailKey = rec.thumbnailKey;
        }
      }

      if (thumbnailKey) {
        await deleteFromS3(thumbnailKey);
      }

      if (isDatabaseConnected && db) {
        try {
          console.log(`tRPC: Deleting Absolute Cinema movie ${input.id} from database...`);
          await db.delete(schema.absoluteCinema)
            .where(and(eq(schema.absoluteCinema.id, input.id), eq(schema.absoluteCinema.userId, userId)));
          return { success: true };
        } catch (err) {
          console.error('Database query error in deleteAbsoluteCinema:', err);
        }
      }

      // Fallback
      console.log(`tRPC: Deleting mock Absolute Cinema movie ${input.id}...`);
      const recIdx = mockAbsoluteCinema.findIndex((r) => r.id === input.id && r.userId === userId);
      if (recIdx !== -1) {
        mockAbsoluteCinema.splice(recIdx, 1);
        saveMockAbsoluteCinema(mockAbsoluteCinema);
      }
      return { success: true };
    }),

  // ==========================================
  // FRIEND RECOMMENDATIONS ENDPOINTS
  // ==========================================

  // Get all ranked recommendations (publicly readable)
  getRecommendations: publicProcedure.query(async () => {
    if (isDatabaseConnected && db) {
      try {
        console.log('tRPC: Fetching recommendations from database...');
        const results = await db.select().from(schema.recommendations).orderBy(schema.recommendations.rank);
        return results;
      } catch (err) {
        console.error('Database query error in getRecommendations, falling back to mock:', err);
      }
    }
    
    // In-memory fallback
    console.log('tRPC: Fetching mock recommendations...');
    return [...mockRecommendations].sort((a, b) => a.rank - b.rank);
  }),

  // Add a ranked recommendation (publicly submittable)
  addRecommendation: publicProcedure
    .input(recommendationInputSchema)
    .mutation(async ({ input }) => {
      const recId = Math.random().toString(36).substring(2, 11);
      
      const newRec = {
        id: recId,
        title: input.title,
        thumbnailUrl: input.thumbnailUrl,
        thumbnailKey: input.thumbnailKey || null,
        rank: input.rank,
        recommendedBy: input.recommendedBy,
        createdAt: new Date(),
      };

      if (isDatabaseConnected && db) {
        try {
          console.log('tRPC: Inserting new recommendation into database:', input.title);
          await db.insert(schema.recommendations).values({
            id: newRec.id,
            title: newRec.title,
            thumbnailUrl: newRec.thumbnailUrl,
            thumbnailKey: newRec.thumbnailKey,
            rank: newRec.rank,
            recommendedBy: newRec.recommendedBy,
          });
          return { success: true, recommendation: newRec };
        } catch (err) {
          console.error('Database error in addRecommendation, falling back to mock:', err);
        }
      }

      // In-memory fallback
      console.log('tRPC: Saving recommendation in-memory:', input.title);
      mockRecommendations.push(newRec as MockRecommendation);
      saveMockRecommendations(mockRecommendations);
      return { success: true, recommendation: newRec };
    }),

  // Delete/Reject a recommendation (admin/owner only)
  deleteRecommendation: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => {
      let thumbnailKey: string | null = null;
      if (isDatabaseConnected && db) {
        try {
          const results = await db.select({ key: schema.recommendations.thumbnailKey })
            .from(schema.recommendations)
            .where(eq(schema.recommendations.id, input.id))
            .limit(1);
          if (results.length > 0) {
            thumbnailKey = results[0].key;
          }
        } catch (err) {
          console.error('Error fetching rec key:', err);
        }
      } else {
        const rec = mockRecommendations.find((r) => r.id === input.id);
        if (rec) {
          thumbnailKey = rec.thumbnailKey;
        }
      }

      if (thumbnailKey) {
        await deleteFromS3(thumbnailKey);
      }

      if (isDatabaseConnected && db) {
        try {
          console.log(`tRPC: Deleting recommendation ${input.id} from database...`);
          await db.delete(schema.recommendations)
            .where(eq(schema.recommendations.id, input.id));
          return { success: true };
        } catch (err) {
          console.error('Database query error in deleteRecommendation:', err);
        }
      }

      // Fallback
      console.log(`tRPC: Deleting mock recommendation ${input.id}...`);
      const recIdx = mockRecommendations.findIndex((r) => r.id === input.id);
      if (recIdx !== -1) {
        mockRecommendations.splice(recIdx, 1);
        saveMockRecommendations(mockRecommendations);
      }
      return { success: true };
    }),

  // Edit a ranked recommendation (admin/owner managed)
  editRecommendation: publicProcedure
    .input(recommendationEditSchema)
    .mutation(async ({ input }) => {
      if (isDatabaseConnected && db) {
        try {
          console.log(`tRPC: Updating recommendation ${input.id} in database...`);
          const updateData: Partial<typeof schema.recommendations.$inferInsert> = {};
          if (input.title) updateData.title = input.title;
          if (input.rank !== undefined) updateData.rank = input.rank;
          if (input.thumbnailUrl) updateData.thumbnailUrl = input.thumbnailUrl;
          if (input.thumbnailKey !== undefined) updateData.thumbnailKey = input.thumbnailKey;
          if (input.recommendedBy) updateData.recommendedBy = input.recommendedBy;

          await db.update(schema.recommendations)
            .set(updateData)
            .where(eq(schema.recommendations.id, input.id));
            
          return { success: true };
        } catch (err) {
          console.error('Database error in editRecommendation, falling back to mock:', err);
        }
      }

      // In-memory fallback
      console.log(`tRPC: Updating mock recommendation ${input.id}...`);
      const recIdx = mockRecommendations.findIndex((r) => r.id === input.id);
      if (recIdx === -1) {
        throw new Error('Recommendation not found');
      }

      const existing = mockRecommendations[recIdx];
      mockRecommendations[recIdx] = {
        ...existing,
        title: input.title ?? existing.title,
        rank: input.rank ?? existing.rank,
        thumbnailUrl: input.thumbnailUrl ?? existing.thumbnailUrl,
        thumbnailKey: input.thumbnailKey !== undefined ? input.thumbnailKey : existing.thumbnailKey,
        recommendedBy: input.recommendedBy ?? existing.recommendedBy,
      };
      saveMockRecommendations(mockRecommendations);

      return { success: true, recommendation: mockRecommendations[recIdx] };
    }),
});

export type AppRouter = typeof appRouter;
