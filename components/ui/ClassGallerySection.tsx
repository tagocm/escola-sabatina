import { deleteClassGalleryPhotoAction, getTeacherGalleryPhotos } from "@/app/actions/gallery";
import ClassGalleryUploadForm from "@/components/ui/ClassGalleryUploadForm";
import { gridCardClass, sectionTitleClass, statusBadgeClass } from "@/components/ui/design-system";
import { formatGalleryPhotoTagLabel, formatSabbathDateLabel } from "@/lib/gallery/sabbath";
import { Camera, ImageOff, Tag, Trash2 } from "lucide-react";
import Image from "next/image";

interface GalleryPhoto {
  id: string;
  week_date: string;
  original_filename: string | null;
  tags: string[];
  caption: string | null;
  created_at: string;
}

interface ClassGallerySectionProps {
  classId: string;
  weekDate: string;
}

export default async function ClassGallerySection({
  classId,
  weekDate,
}: ClassGallerySectionProps) {
  const photos = await getTeacherGalleryPhotos(classId, weekDate) as GalleryPhoto[];

  return (
    <section className="flex flex-col gap-5" id="fotos-da-aula">
      <div className="flex flex-col gap-2 border-b-4 border-foreground/10 pb-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center border-4 border-foreground bg-es-blue shadow-editorial-sm">
            <Camera className="h-5 w-5 stroke-[3]" />
          </div>
          <div>
            <h2 className={sectionTitleClass}>Fotos da Aula</h2>
            <p className="text-[9px] font-black uppercase tracking-[0.18em] text-foreground/35">
              {formatSabbathDateLabel(weekDate)}
            </p>
          </div>
        </div>

        <span className="self-start border-4 border-foreground bg-surface px-3 py-1 text-xs font-black shadow-editorial-sm sm:self-auto">
          {photos.length}
        </span>
      </div>

      <ClassGalleryUploadForm
        classId={classId}
        defaultWeekDate={weekDate}
        lockWeekDate
      />

      {photos.length === 0 ? (
        <div className="border-4 border-dashed border-foreground/30 bg-surface px-5 py-8 text-center">
          <ImageOff className="mx-auto h-12 w-12 stroke-[1.5] opacity-20" />
          <p className="mt-3 text-sm font-black uppercase tracking-tight opacity-40">
            Nenhuma foto enviada para este sábado
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3 md:gap-6">
          {photos.map((photo) => (
            <article key={photo.id} className={`${gridCardClass} relative`}>
              <form
                action={deleteClassGalleryPhotoAction.bind(null, photo.id)}
                className="absolute right-3 top-3 z-10"
              >
                <button
                  type="submit"
                  className="flex h-10 w-10 items-center justify-center border-4 border-foreground bg-surface shadow-editorial-sm transition-all hover:bg-danger hover:text-surface active:translate-x-0.5 active:translate-y-0.5"
                  title="Remover foto"
                  aria-label="Remover foto"
                >
                  <Trash2 className="h-4 w-4 stroke-[3]" />
                </button>
              </form>

              <div className="relative aspect-[4/3] w-full overflow-hidden border-b-4 border-foreground bg-background">
                <Image
                  src={`/galeria/fotos/${photo.id}`}
                  alt={photo.caption || photo.tags.map(formatGalleryPhotoTagLabel).join(", ") || "Foto da aula"}
                  fill
                  unoptimized
                  sizes="(max-width: 768px) 100vw, 360px"
                  className="object-cover transition-transform group-hover:scale-105"
                />
              </div>

              <div className="flex min-h-24 flex-col gap-3 p-4">
                <div className="flex items-center gap-2 text-[9px] font-black uppercase tracking-[0.18em] opacity-40">
                  <Camera className="h-3.5 w-3.5 stroke-[3]" />
                  {new Date(photo.created_at).toLocaleDateString("pt-BR")}
                </div>
                <div className="flex flex-wrap gap-2">
                  {photo.tags.map((tag) => (
                    <span key={tag} className={`${statusBadgeClass} bg-es-yellow`}>
                      <Tag className="h-3 w-3 stroke-[3]" />
                      {formatGalleryPhotoTagLabel(tag)}
                    </span>
                  ))}
                </div>
                {photo.caption ? (
                  <p className="line-clamp-2 text-[11px] font-bold uppercase leading-tight opacity-60">
                    {photo.caption}
                  </p>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
