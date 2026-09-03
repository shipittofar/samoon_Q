'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import type { TenantBrandingConfig } from '@/types/provisioning'
import {
  BRANDING_PALETTE_PRESETS,
  buildLanguageFontCatalog,
  defaultFontsByLocale,
  findPaletteForPrimary,
  fontIdFromStored,
  type BrandingPalettePreset,
} from '@/config/branding-defaults'
import { Check } from 'lucide-react'
import { ImageUploader, EMPTY_IMAGE_FIELD, type ImageFieldValue } from '@/components/ImageUploader'
import { resolveSupportedLocales, resolveDefaultLocale, getLanguageInfo } from '@/i18n/runtime'

export interface BrandingDefaultsStepProps {
  branding: TenantBrandingConfig
  onChange: (next: TenantBrandingConfig) => void
  /** Selected logo File — becomes multipart `image` on provision (never settings.theme). */
  logoFile: File | null
  onLogoFileChange: (file: File | null) => void
  templateDefaults: TenantBrandingConfig
  colorError?: string
}

function applyPalette(
  prev: TenantBrandingConfig,
  palette: BrandingPalettePreset,
): TenantBrandingConfig {
  return {
    ...prev,
    primaryColor: palette.primaryColor,
    accentHoverColor: palette.accentHoverColor,
  }
}

export function BrandingDefaultsStep({
  branding,
  onChange,
  logoFile,
  onLogoFileChange,
  templateDefaults,
  colorError,
}: BrandingDefaultsStepProps) {
  const t = useTranslations('console')
  const locales = useMemo(() => resolveSupportedLocales(), [])
  const defaultLocale = useMemo(() => resolveDefaultLocale(), [])
  const languageFonts = useMemo(() => buildLanguageFontCatalog(locales), [locales])
  const seededRef = useRef(false)
  const [logoField, setLogoField] = useState<ImageFieldValue>(() =>
    logoFile
      ? { file: logoFile, existingUrl: '', cleared: false }
      : EMPTY_IMAGE_FIELD,
  )

  // Seed once when Step 3 mounts with empty branding.
  useEffect(() => {
    if (seededRef.current) return
    seededRef.current = true
    if (branding.primaryColor || branding.fontBody || branding.fontsByLocale) return

    const palette = findPaletteForPrimary(templateDefaults.primaryColor ?? undefined)
    const fontsByLocale = defaultFontsByLocale(locales)
    onChange(
      applyPalette(
        {
          ...templateDefaults,
          fontsByLocale,
          fontBody: fontsByLocale[defaultLocale] ?? fontsByLocale.en ?? templateDefaults.fontBody,
        },
        palette,
      ),
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps -- seed once on step mount
  }, [])

  const selectedPalette =
    BRANDING_PALETTE_PRESETS.find(
      (p) =>
        p.primaryColor.toLowerCase() === (branding.primaryColor ?? '').toLowerCase() &&
        p.accentHoverColor.toLowerCase() === (branding.accentHoverColor ?? '').toLowerCase(),
    ) ?? findPaletteForPrimary(branding.primaryColor ?? templateDefaults.primaryColor ?? undefined)

  function selectPalette(palette: BrandingPalettePreset) {
    onChange(applyPalette(branding, palette))
  }

  function selectLanguageFont(locale: string, fontId: string) {
    const entry = languageFonts.find((e) => e.code === locale)
    if (!entry) return
    const fontsByLocale = {
      ...(branding.fontsByLocale ?? defaultFontsByLocale(locales)),
      [locale]: fontId,
    }
    onChange({
      ...branding,
      fontsByLocale,
      // API contract field: default-locale selection drives TenantBranding.fontBody
      fontBody: fontsByLocale[defaultLocale] ?? fontsByLocale[locale] ?? fontId,
    })
  }

  function handleLogoChange(next: ImageFieldValue) {
    setLogoField(next)
    if (next.cleared || (!next.file && !next.existingUrl)) {
      onLogoFileChange(null)
      return
    }
    if (next.file) {
      onLogoFileChange(next.file)
      return
    }
    onLogoFileChange(null)
  }

  return (
    <div className="space-y-8">
      {/* 1. Palette cards */}
      <fieldset>
        <legend className="block text-sm font-medium mb-1">
          {t('colorPaletteLabel')}{' '}
          <span className="text-xs font-normal text-gray-400">{t('requiredLabel')}</span>
        </legend>
        <p className="text-xs text-gray-500 mb-3">{t('colorPaletteHint')}</p>
        <div
          className={`grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 ${
            colorError ? 'rounded-lg ring-1 ring-red-500 p-1 -m-1' : ''
          }`}
          role="radiogroup"
          aria-label={t('colorPaletteLabel')}
          aria-invalid={colorError ? true : undefined}
          aria-describedby={colorError ? 'tenant-color-error' : undefined}
        >
          {BRANDING_PALETTE_PRESETS.map((palette) => {
            const selected = selectedPalette.id === palette.id
            return (
              <button
                key={palette.id}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => selectPalette(palette)}
                className={`rounded-xl border overflow-hidden text-start transition-shadow ${
                  selected
                    ? 'border-accent ring-2 ring-accent shadow-sm'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div
                  className="h-16 px-3 py-2 flex flex-col justify-between min-w-0"
                  style={{ backgroundColor: palette.backgroundColor, color: palette.textColor }}
                >
                  <span className="text-[11px] font-semibold truncate leading-tight">
                    {t(palette.labelKey)}
                  </span>
                  <span className="flex items-center gap-1.5 min-w-0">
                    <span
                      className="inline-block text-[10px] font-medium px-1.5 py-0.5 rounded shrink-0"
                      style={{ backgroundColor: palette.primaryColor, color: '#ffffff' }}
                    >
                      Aa
                    </span>
                    <span className="text-[10px] truncate opacity-80">{t('paletteTextSample')}</span>
                  </span>
                </div>
                <div className="flex h-2" aria-hidden="true">
                  <span className="flex-1" style={{ backgroundColor: palette.primaryColor }} />
                  <span className="flex-1" style={{ backgroundColor: palette.accentHoverColor }} />
                  <span className="flex-1" style={{ backgroundColor: palette.textColor }} />
                  <span className="flex-1" style={{ backgroundColor: palette.backgroundColor }} />
                </div>
              </button>
            )
          })}
        </div>
        {colorError ? (
          <p id="tenant-color-error" role="alert" className="text-xs text-red-600 mt-2">
            {colorError}
          </p>
        ) : null}
      </fieldset>

      {/* 2. Logo — multipart `image` field (not settings.theme) */}
      <ImageUploader
        value={logoField}
        onChange={handleLogoChange}
        label={t('logoUploadLabel')}
        hint={t('logoUploadHint')}
        uploadLabel={t('uploadLogoLabel')}
        changeLabel={t('changeLogoLabel')}
        removeLabel={t('removeLogoLabel')}
        previewLabel={t('logoPreviewLabel')}
      />

      {/* 3. Per-language fonts (font IDs stored for backend) */}
      <fieldset>
        <legend className="block text-sm font-semibold mb-1">{t('perLanguageFontsLabel')}</legend>
        <p className="text-xs text-gray-500 mb-4">{t('perLanguageFontsHint')}</p>
        <div className="space-y-5">
          {languageFonts.map((entry) => {
            const info = getLanguageInfo(entry.code)
            const title = info ? `${info.nativeName} (${info.englishName})` : entry.code
            const isDefaultLocale = entry.code === defaultLocale
            const selectedId = fontIdFromStored(
              entry,
              branding.fontsByLocale?.[entry.code] ?? branding.fontBody ?? undefined,
            )

            return (
              <div key={entry.code} className="rounded-xl border border-gray-200 p-4">
                <div className="mb-3">
                  <p className="text-sm font-semibold text-gray-800">{title}</p>
                  {isDefaultLocale ? (
                    <p className="text-xs text-gray-500 mt-0.5">{t('fontDefaultLocaleHint')}</p>
                  ) : (
                    <p className="text-xs text-gray-500 mt-0.5">{t('fontLocaleHint')}</p>
                  )}
                </div>
                <div
                  className="grid grid-cols-1 sm:grid-cols-2 gap-2"
                  role="radiogroup"
                  aria-label={t('fontForLanguageAria', { language: title })}
                >
                  {entry.fonts.map((font) => {
                    const selected = selectedId === font.id
                    return (
                      <button
                        key={font.id}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        data-font-id={font.id}
                        data-selected={selected ? 'true' : 'false'}
                        onClick={() => selectLanguageFont(entry.code, font.id)}
                        className={`relative border rounded-lg px-3 py-3 text-start transition-colors ${
                          selected
                            ? 'border-accent bg-accent/5 ring-2 ring-accent'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        {selected ? (
                          <span className="absolute top-2 end-2 inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-accent">
                            <Check className="w-3.5 h-3.5" aria-hidden="true" />
                            {t('fontSelectedLabel')}
                          </span>
                        ) : null}
                        <span
                          className="block text-base font-medium pr-16"
                          style={{ fontFamily: font.cssFamily }}
                        >
                          {font.name}
                        </span>
                        <span
                          className="block text-sm text-gray-600 mt-1 leading-snug"
                          style={{ fontFamily: font.cssFamily }}
                        >
                          {t('fontSamplePreview', { fontFamily: font.name })}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      </fieldset>
    </div>
  )
}
